import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/apiClient';
import { isDemoLoaded, seedDemoAtlas } from '../demo/demoApi';
import { formatClock, subjectColorVar } from '../../lib/formatters';
import { loadBreathingRecord } from './breathing';
import BreathingPause from './BreathingPause';
import ContourRing from './ContourRing';
import SubjectPicker from './SubjectPicker';
import { FOCUS_SECONDS, isReady } from './timerMachine';
import { useTimer } from './useTimer';

const NOTICE_COPY = {
  reset: 'Session cleared. Begin again when ready.',
  away: 'Session completed while you were away.',
  break_finished: 'Break finished. Ready when you are.',
};

export default function TimerPage() {
  const { state, remaining, progress, dispatch } = useTimer();
  const { phase } = state;

  const [pickerKey, setPickerKey] = useState(0);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(isDemoLoaded);
  // A refresh-interrupted breathing pause reopens on its own.
  const [breathingOpen, setBreathingOpen] = useState(
    () => loadBreathingRecord() != null
  );

  useEffect(() => {
    const onChange = () => setDemoLoaded(isDemoLoaded());
    window.addEventListener('focus-atlas:demo-changed', onChange);
    return () =>
      window.removeEventListener('focus-atlas:demo-changed', onChange);
  }, []);

  const exploreSample = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      await seedDemoAtlas();
      setPickerKey((k) => k + 1); // picker refetches the seeded subjects
    } finally {
      setDemoBusy(false);
    }
  };

  // The demo session is a reviewer tool: one click, no prerequisites.
  // It pins the seeded "Work" subject (first subject as fallback) so it
  // never waits on a selection.
  const startDemoSession = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      const subjects = await api('/subjects');
      const subject =
        subjects.find((s) => s.name.trim().toLowerCase() === 'work') ||
        subjects[0];
      if (!subject) return; // no subjects at all — picker already explains
      dispatch({
        type: 'SELECT_SUBJECT',
        subjectId: subject.id,
        subjectName: subject.name,
      });
      dispatch({
        type: 'START',
        now: Date.now(),
        durationSeconds: 10,
        completionId: crypto.randomUUID(),
      });
    } catch {
      // server unreachable — the subject picker surfaces the error state
    } finally {
      setDemoBusy(false);
    }
  };

  const ready = isReady(phase);
  const inFocus = phase === 'running_focus' || phase === 'paused_focus';
  const inBreak = phase === 'running_break' || phase === 'paused_break';
  const paused = phase === 'paused_focus' || phase === 'paused_break';

  // Polite screen-reader announcements: state changes + whole minutes.
  const [announcement, setAnnouncement] = useState('');
  const lastMinuteRef = useRef(null);
  useEffect(() => {
    if (phase === 'running_break') {
      setAnnouncement('Focus session complete. Break started.');
    } else if (phase === 'break_complete') {
      setAnnouncement('Break finished.');
    }
  }, [phase]);
  useEffect(() => {
    if (phase !== 'running_focus') {
      lastMinuteRef.current = null;
      return;
    }
    const minutes = Math.floor(remaining / 60);
    if (remaining % 60 === 0 && minutes > 0 && lastMinuteRef.current !== minutes) {
      lastMinuteRef.current = minutes;
      setAnnouncement(
        `${minutes} minute${minutes === 1 ? '' : 's'} remaining`
      );
    }
  }, [phase, remaining]);

  const start = () =>
    dispatch({
      type: 'START',
      now: Date.now(),
      durationSeconds: FOCUS_SECONDS,
      completionId: crypto.randomUUID(),
    });

  /* ---------- ready: the question, not a clock ---------- */
  if (ready) {
    if (breathingOpen) {
      return <BreathingPause onClose={() => setBreathingOpen(false)} />;
    }
    return (
      <div className="timer-page">
        <h1 className="timer-question">What will receive your attention?</h1>
        <p className="timer-question-sub">
          Choose a subject and set one clear intention.
        </p>

        <SubjectPicker
          key={pickerKey}
          selectedId={state.subjectId}
          onSelect={(subject) =>
            dispatch({
              type: 'SELECT_SUBJECT',
              subjectId: subject.id,
              subjectName: subject.name,
            })
          }
        />

        <div className="intention-block">
          <label className="micro-label" htmlFor="intention">
            Intention — optional
          </label>
          <input
            id="intention"
            value={state.intention}
            maxLength={280}
            placeholder="Finish the first draft"
            onChange={(event) =>
              dispatch({ type: 'SET_INTENTION', intention: event.target.value })
            }
          />
        </div>

        <p className="timer-duration">25-minute focus</p>

        {state.notice && NOTICE_COPY[state.notice] && (
          <p className="field-note" role="status">
            {NOTICE_COPY[state.notice]}
          </p>
        )}
        {state.outbox.some((item) => item.status === 'queued') && (
          <p className="field-note" role="status">
            Saved on this device — syncing.
          </p>
        )}

        <div className="timer-controls">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={state.subjectId == null}
            onClick={start}
          >
            Begin focus
          </button>
        </div>

        {/* On-demand breathing: no subject, no saving, whenever wanted. */}
        <button
          type="button"
          className="btn btn-quiet demo-entry"
          onClick={() => setBreathingOpen(true)}
        >
          Take a breathing pause
        </button>

        {/* Reviewer path — one quiet line, always reachable from any state,
            always plainly labeled, never disguised. Creating a subject
            first must not strand the reviewer (found by the owner). */}
        {demoLoaded ? (
          <button
            type="button"
            className="btn btn-quiet demo-entry"
            disabled={demoBusy}
            onClick={startDemoSession}
          >
            Try a 10-second demo session
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-quiet demo-entry"
            disabled={demoBusy}
            onClick={exploreSample}
          >
            {demoBusy ? 'Preparing sample atlas…' : 'Explore a sample atlas'}
          </button>
        )}

        <div className="sr-only" aria-live="polite">
          {announcement}
        </div>
      </div>
    );
  }

  /* ---------- focus / break: the room, not a dashboard ---------- */
  const ringProgress = inBreak ? 1 - progress : progress;
  const ringLabel = inBreak
    ? `Break time remaining, ${Math.round((1 - progress) * 100)} percent`
    : `Focus progress, ${Math.round(progress * 100)} percent complete`;

  // The break is always quiet (D34): a still contour and one line of
  // copy. Guided breathing lives solely behind "Take a breathing pause" —
  // something the user chooses, never something the app starts.
  return (
    <div className="timer-page">
      <ContourRing
        progress={ringProgress}
        seed={
          (state.subjectId || 1) * 31 +
          (state.startedAt ? state.startedAt % 1009 : 0)
        }
        paused={paused}
        label={ringLabel}
        valueNow={Math.round(ringProgress * 100)}
        color={inBreak ? null : subjectColorVar(state.subjectId || 1)}
      >
        <span className="stage-subject">
          {inBreak ? 'BREAK' : state.subjectName}
        </span>
        <span className="stage-clock" role="timer">
          {formatClock(remaining)}
        </span>
        <span className="stage-status" role="status">
          {phase === 'paused_focus' && 'Focus paused'}
          {phase === 'paused_break' && 'Break paused'}
          {phase === 'running_break' && 'Let your attention widen.'}
        </span>
        {inFocus && state.intention && (
          <span className="stage-intention">{state.intention}</span>
        )}
      </ContourRing>

      <div className="timer-controls">
        {(phase === 'running_focus' || phase === 'running_break') && (
          <button
            type="button"
            className="btn"
            onClick={() => dispatch({ type: 'PAUSE', now: Date.now() })}
          >
            Pause
          </button>
        )}
        {paused && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => dispatch({ type: 'RESUME', now: Date.now() })}
          >
            Resume
          </button>
        )}
        {inFocus && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => dispatch({ type: 'RESET', now: Date.now() })}
          >
            Reset
          </button>
        )}
        {inBreak && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => dispatch({ type: 'SKIP_BREAK' })}
          >
            Skip break
          </button>
        )}
      </div>


      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
