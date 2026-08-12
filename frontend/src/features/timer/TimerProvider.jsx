import { useCallback, useEffect, useReducer, useState } from 'react';
import { useLocation } from 'react-router';
import { TimerContext } from './timerContext';
import {
  deriveRemaining,
  initialState,
  modeFor,
  reconcile,
  reducer,
} from './timerMachine';
import { loadTimerRecord, persistTimerState } from './timerStorage';

// The timer lives ABOVE the routes (Codex audit round 1): navigating to
// History/Dashboard must not unmount the scheduler, the wake listeners,
// or the save flow. Only the Timer route wears focus/break visuals.

function initFromStorage() {
  return reconcile(loadTimerRecord() || initialState, Date.now());
}

export function TimerProvider({ onComplete, children }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, initFromStorage);
  const [now, setNow] = useState(() => Date.now());
  const location = useLocation();

  // Time-bearing events repaint immediately — no stale first frame after
  // a long pause (audit MINOR).
  const dispatch = useCallback((event) => {
    if (event && typeof event.now === 'number') setNow(event.now);
    rawDispatch(event);
  }, []);

  const running =
    state.phase === 'running_focus' || state.phase === 'running_break';
  const remaining = deriveRemaining(state, now);
  const progress =
    state.durationSeconds > 0
      ? Math.min(1, Math.max(0, 1 - remaining / state.durationSeconds))
      : 0;

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
    if (state.phase === 'running_focus' && remaining === 0) {
      rawDispatch({ type: 'FOCUS_ELAPSED', now: Date.now() });
    } else if (state.phase === 'running_break' && remaining === 0) {
      rawDispatch({ type: 'BREAK_ELAPSED', now: Date.now() });
    }
  }, [state.phase, remaining]);

  // Save flow — independent of the timer phase; the break never waits.
  // Duplicate requests are possible (StrictMode/reload); the server's
  // idempotency key makes them harmless.
  useEffect(() => {
    if (!state.save || state.save.status !== 'pending') return undefined;
    let cancelled = false;
    Promise.resolve(onComplete ? onComplete(state.save.session) : null)
      .then(() => {
        if (!cancelled) rawDispatch({ type: 'SAVE_SUCCEEDED' });
      })
      .catch(() => {
        if (!cancelled) rawDispatch({ type: 'SAVE_FAILED' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.save]);

  // Persist every transition; idle-with-nothing-owed clears the record.
  useEffect(() => {
    persistTimerState(state);
  }, [state]);

  // Visual mode: focus/break only on the Timer route. Elsewhere stays paper,
  // while the timer itself keeps running underneath.
  useEffect(() => {
    const onTimerRoute = location.pathname === '/';
    document.documentElement.dataset.mode = onTimerRoute
      ? modeFor(state.phase)
      : 'paper';
    return () => {
      document.documentElement.dataset.mode = 'paper';
    };
  }, [state.phase, location.pathname]);

  // The completion overlay clears itself; it never blocks the break.
  useEffect(() => {
    if (!state.overlay) return undefined;
    const id = setTimeout(() => rawDispatch({ type: 'CLEAR_OVERLAY' }), 2200);
    return () => clearTimeout(id);
  }, [state.overlay]);

  const value = { state, now, remaining, progress, dispatch };
  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
