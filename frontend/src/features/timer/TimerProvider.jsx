import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
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

  // Save flow — an outbox keyed by completionId, independent of the timer
  // phase. Each item resolves on its own; a slow request never blocks the
  // break or a later session's save. Duplicate requests remain possible
  // (StrictMode remount/reload); the server's idempotency key absorbs them.
  const inFlightRef = useRef(new Set());
  useEffect(() => {
    state.outbox
      .filter(
        (item) =>
          item.status === 'pending' &&
          !inFlightRef.current.has(item.session.completionId)
      )
      .forEach((item) => {
        const id = item.session.completionId;
        inFlightRef.current.add(id);
        Promise.resolve(onComplete ? onComplete(item.session) : null)
          .then(() => rawDispatch({ type: 'SAVE_SUCCEEDED', completionId: id }))
          .catch(() => rawDispatch({ type: 'SAVE_FAILED', completionId: id }))
          .finally(() => inFlightRef.current.delete(id));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outbox]);

  // Queued (failed) saves retry on load and whenever the network returns.
  useEffect(() => {
    rawDispatch({ type: 'RETRY_SAVES' });
    const retry = () => rawDispatch({ type: 'RETRY_SAVES' });
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

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
