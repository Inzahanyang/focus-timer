import { useEffect, useReducer, useState } from 'react';
import {
  deriveRemaining,
  initialState,
  modeFor,
  reconcile,
  reducer,
} from './timerMachine';
import { loadTimerRecord, persistTimerState } from './timerStorage';

function initFromStorage() {
  return reconcile(loadTimerRecord() || initialState, Date.now());
}

/**
 * Binds the pure machine to the browser: repaint interval, persistence,
 * wake-up reconciliation, elapsed detection, and the save flow.
 *
 * `onComplete(session)` runs when a focus session finishes; it must resolve
 * (or throw) — Day 1 stub resolves immediately, later it POSTs /sessions.
 */
export function useFocusTimer(onComplete) {
  const [state, dispatch] = useReducer(reducer, undefined, initFromStorage);
  const [now, setNow] = useState(() => Date.now());

  const running =
    state.status === 'running_focus' || state.status === 'running_break';
  const remaining = deriveRemaining(state, now);
  const progress =
    state.durationSeconds > 0 ? 1 - remaining / state.durationSeconds : 0;

  // Repaint only — never the source of truth (D3).
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  // Wall-clock reconciliation whenever the tab wakes up.
  useEffect(() => {
    const wake = () => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('pageshow', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('pageshow', wake);
    };
  }, []);

  // Elapsed detection. The reducer ignores duplicates (StrictMode-safe).
  useEffect(() => {
    if (state.status === 'running_focus' && remaining === 0) {
      dispatch({ type: 'FOCUS_ELAPSED', now: Date.now() });
    } else if (state.status === 'running_break' && remaining === 0) {
      dispatch({ type: 'BREAK_ELAPSED', now: Date.now() });
    }
  }, [state.status, remaining]);

  // Save flow: saving_focus -> SAVE_SUCCEEDED / SAVE_QUEUED.
  useEffect(() => {
    if (state.status !== 'saving_focus') return;
    let cancelled = false;
    Promise.resolve(
      onComplete ? onComplete(state.completedSession) : null
    )
      .then(() => {
        if (!cancelled) dispatch({ type: 'SAVE_SUCCEEDED', now: Date.now() });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'SAVE_QUEUED', now: Date.now() });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // Persist every transition; idle states clear the record.
  useEffect(() => {
    persistTimerState(state);
  }, [state]);

  // Mode drives the visual world: paper / focus / break.
  useEffect(() => {
    document.documentElement.dataset.mode = modeFor(state.status);
    return () => {
      document.documentElement.dataset.mode = 'paper';
    };
  }, [state.status]);

  // The completion overlay clears itself; the break underneath is not blocked.
  useEffect(() => {
    if (!state.completedSession || state.status === 'saving_focus')
      return undefined;
    const id = setTimeout(() => dispatch({ type: 'CLEAR_COMPLETION' }), 2200);
    return () => clearTimeout(id);
  }, [state.completedSession, state.status]);

  return { state, remaining, progress, dispatch };
}
