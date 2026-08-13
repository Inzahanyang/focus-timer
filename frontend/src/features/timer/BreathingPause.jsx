import { useEffect, useState } from 'react';
import { formatClock } from '../../lib/formatters';
import {
  breathState,
  clearBreathingRecord,
  loadBreathingRecord,
  persistBreathingRecord,
} from './breathing';
import ContourRing from './ContourRing';

// Standalone guided breathing (D33): user-initiated, subject-free, and
// deliberately unrecorded — no /sessions call, no stats impact. Focus
// leaves a contour; a breathing pause just breathes and goes.

const DURATIONS = [1, 3, 5];
const DEFAULT_MINUTES = 3;
const BREATHING_SEED = 7; // one consistent terrain for every breath

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function BreathingPause({ onClose }) {
  // Restore a refresh-interrupted pause; a record that finished while we
  // were away resolves to the completion note, never a stale countdown.
  const [session, setSession] = useState(() => {
    const restored = loadBreathingRecord();
    if (
      restored &&
      restored.status === 'running' &&
      restored.endAt <= Date.now()
    ) {
      clearBreathingRecord();
      return { status: 'done' };
    }
    return restored;
  });
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [now, setNow] = useState(() => Date.now());

  const running = session?.status === 'running';
  const paused = session?.status === 'paused';
  const done = session?.status === 'done';

  // Repaint + wall-clock reconciliation (same discipline as the timer).
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const wake = () => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, []);

  useEffect(() => {
    persistBreathingRecord(running || paused ? session : null);
  }, [session, running, paused]);

  const remainingMs = running
    ? Math.max(0, session.endAt - now)
    : paused
      ? session.remainingMs
      : 0;

  // Natural completion.
  useEffect(() => {
    if (running && remainingMs === 0) {
      clearBreathingRecord();
      setSession({ status: 'done' });
    }
  }, [running, remainingMs]);

  const elapsedMs =
    running || paused ? session.durationS * 1000 - remainingMs : 0;
  const breath = breathState(elapsedMs);
  const breathAmount = prefersReducedMotion() ? undefined : breath.amount;
  const remainingFraction =
    running || paused ? remainingMs / (session.durationS * 1000) : 0;

  const begin = () => {
    const startNow = Date.now();
    setNow(startNow); // no stale first frame
    setSession({
      status: 'running',
      durationS: minutes * 60,
      endAt: startNow + minutes * 60 * 1000,
      remainingMs: minutes * 60 * 1000,
    });
  };

  const pause = () => {
    // Expiry beats the command, same as the main timer: pausing on the
    // final frame completes instead of freezing a 1ms remainder.
    const left = session.endAt - Date.now();
    if (left <= 0) {
      clearBreathingRecord();
      setSession({ status: 'done' });
      return;
    }
    setSession((current) => ({
      ...current,
      status: 'paused',
      remainingMs: left,
      endAt: null,
    }));
  };

  const resume = () => {
    const resumeNow = Date.now();
    setNow(resumeNow);
    setSession((current) => ({
      ...current,
      status: 'running',
      endAt: resumeNow + current.remainingMs,
    }));
  };

  const end = () => {
    clearBreathingRecord();
    onClose();
  };

  /* ---------- complete ---------- */
  if (done) {
    return (
      <div className="timer-page">
        <p className="timer-question" role="status">
          Breathing complete.
        </p>
        <div className="timer-controls">
          <button type="button" className="btn btn-primary" onClick={end}>
            Return to focus
          </button>
        </div>
      </div>
    );
  }

  /* ---------- picker ---------- */
  if (!running && !paused) {
    return (
      <div className="timer-page">
        <span className="micro-label">Guided breathing</span>
        <h1 className="timer-question">Breathe with the contour.</h1>

        <div
          className="subject-row breathing-durations"
          role="group"
          aria-label="Breathing duration"
        >
          {DURATIONS.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={minutes === value}
              onClick={() => setMinutes(value)}
            >
              {value} min
            </button>
          ))}
        </div>

        <div className="timer-controls">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={begin}
          >
            Begin breathing
          </button>
        </div>
        <button
          type="button"
          className="btn btn-quiet demo-entry"
          onClick={end}
        >
          Back to focus
        </button>
      </div>
    );
  }

  /* ---------- running / paused ---------- */
  return (
    <div className="timer-page">
      <ContourRing
        progress={remainingFraction}
        seed={BREATHING_SEED}
        paused={paused}
        label={`Breathing time remaining, ${Math.round(
          remainingFraction * 100
        )} percent`}
        valueNow={Math.round(remainingFraction * 100)}
        breathAmount={breathAmount}
      >
        <span className="stage-subject">BREATHE</span>
        {/* Screen readers get the rhythm once, not every four seconds. */}
        <span className="sr-only">
          Four seconds in, hold for two, then six seconds out.
        </span>
        <span className="stage-clock" role="timer">
          {formatClock(Math.ceil(remainingMs / 1000))}
        </span>
        <span className="stage-status">
          {paused ? (
            'Paused'
          ) : (
            // key remounts the span per phase so the fade re-runs —
            // a soft crossfade between Breathe in / Hold / Breathe out
            <span
              key={breath.phase}
              aria-hidden="true"
              className="breath-label"
            >
              {breath.label}
            </span>
          )}
        </span>
      </ContourRing>

      <div className="timer-controls">
        {running && (
          <button type="button" className="btn" onClick={pause}>
            Pause
          </button>
        )}
        {paused && (
          <button type="button" className="btn btn-primary" onClick={resume}>
            Resume
          </button>
        )}
        <button type="button" className="btn btn-quiet" onClick={end}>
          End
        </button>
      </div>
    </div>
  );
}
