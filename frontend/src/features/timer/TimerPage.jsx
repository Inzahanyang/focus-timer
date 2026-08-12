import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../../lib/formatters';
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
    return (
      <div className="timer-page">
        <h1 className="timer-question">What will receive your attention?</h1>
        <p className="timer-question-sub">
          Choose a subject and set one clear intention.
        </p>

        <SubjectPicker
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

        <p className="timer-duration">25 minutes</p>

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
            className="btn btn-primary"
            disabled={state.subjectId == null}
            onClick={start}
          >
            Begin focus
          </button>
        </div>

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
