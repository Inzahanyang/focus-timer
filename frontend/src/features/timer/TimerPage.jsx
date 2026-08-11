import { useCallback } from 'react';
import { formatClock } from '../../lib/formatters';
import ContourRing from './ContourRing';
import SubjectPicker from './SubjectPicker';
import { FOCUS_SECONDS } from './timerMachine';
import { useFocusTimer } from './useFocusTimer';

export default function TimerPage() {
  // Day 1: completion save is a stub; POST /sessions arrives with the
  // sessions API. The machine and flow are already final.
  const onComplete = useCallback(async () => null, []);

  const { state, remaining, progress, dispatch } = useFocusTimer(onComplete);
  const { status } = state;

  const ready = status === 'idle_focus' || status === 'break_complete';
  const inFocus =
    status === 'running_focus' ||
    status === 'paused_focus' ||
    status === 'saving_focus';
  const inBreak = status === 'running_break' || status === 'paused_break';

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

        {status === 'break_complete' && (
          <p className="field-note" role="status">
            {state.completedWhileAway
              ? 'Session completed while you were away.'
              : 'Break finished. Ready when you are.'}
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
      </div>
    );
  }

  /* ---------- focus / break: the room, not a dashboard ---------- */
  const paused = status === 'paused_focus' || status === 'paused_break';

  return (
    <div className="timer-page">
      <ContourRing
        progress={inBreak ? 1 - progress : progress}
        seed={state.subjectId || 1}
        paused={paused}
      >
        <span className="stage-subject">
          {inBreak ? 'BREAK' : state.subjectName}
        </span>
        <span className="stage-clock" role="timer" aria-live="off">
          {formatClock(remaining)}
        </span>
        <span className="stage-status" role="status">
          {status === 'paused_focus' && 'Focus paused'}
          {status === 'paused_break' && 'Break paused'}
          {status === 'saving_focus' && 'Saving…'}
          {status === 'running_break' && 'Let your attention widen.'}
        </span>
        {inFocus && state.intention && (
          <span className="stage-intention">{state.intention}</span>
        )}
      </ContourRing>

      <div className="timer-controls">
        {(status === 'running_focus' || status === 'running_break') && (
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
            onClick={() => dispatch({ type: 'RESET' })}
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

      {state.completedSession && status !== 'saving_focus' && (
        <div className="completion" role="status">
          <div className="completion-title">A new contour has been added.</div>
          <div className="completion-meta">
            {state.completedSession.subjectName} ·{' '}
            {state.completedSession.minutes} minutes
          </div>
        </div>
      )}
    </div>
  );
}
