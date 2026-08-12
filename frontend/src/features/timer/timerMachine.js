// Focus Atlas timer state machine.
//
// Two invariants (DECISIONS D3, Codex audit round 1):
//   1. Displayed time is DERIVED from absolute wall-clock timestamps.
//      `endAt` is the truth while running; `remainingMs` while paused.
//      Intervals only repaint.
//   2. The timer phase and the save lifecycle are INDEPENDENT. Focus
//      completion starts the break immediately; saving happens alongside
//      and may fail/retry without ever blocking the timer.
//
// All transitions are pure. Invalid events are ignored, which makes
// completion exactly-once at the machine level.

export const FOCUS_SECONDS = 25 * 60;
export const BREAK_SECONDS = 5 * 60;

export const initialState = {
  phase: 'idle_focus',
  // idle_focus | running_focus | paused_focus
  // running_break | paused_break | break_complete
  subjectId: null,
  subjectName: null,
  intention: '',
  durationSeconds: FOCUS_SECONDS,
  endAt: null, // ms epoch, only while running
  remainingMs: FOCUS_SECONDS * 1000, // authoritative while paused/idle
  startedAt: null,
  pauseCount: 0,
  pausedSeconds: 0,
  pauseStartedAt: null,
  completionId: null, // UUID minted at START; becomes the idempotency key
  // Save lifecycle, independent from the phase.
  // null | { session, status: 'pending' | 'queued' }
  save: null,
  // Completion overlay payload: { subjectName, minutes } | null
  overlay: null,
  // One quiet status line: 'reset' | 'away' | 'break_finished' | null
  notice: null,
};

/** Seconds to display. The only place time is computed. */
export function deriveRemaining(state, now) {
  if (state.phase === 'running_focus' || state.phase === 'running_break') {
    return Math.max(0, Math.ceil((state.endAt - now) / 1000));
  }
  return Math.max(0, Math.ceil(state.remainingMs / 1000));
}

export function modeFor(phase) {
  if (phase === 'running_focus' || phase === 'paused_focus') return 'focus';
  if (phase === 'running_break' || phase === 'paused_break') return 'break';
  return 'paper';
}

const READY_PHASES = ['idle_focus', 'break_complete'];

export function isReady(phase) {
  return READY_PHASES.includes(phase);
}

/**
 * Focus finished: enter the break immediately (anchored at the theoretical
 * focus end, not "now") and record the session for saving. Never blocks.
 */
function completeFocus(state, now, away) {
  const focusEndAt = state.endAt;
  const breakEndAt = focusEndAt + BREAK_SECONDS * 1000;
  const session = {
    subjectId: state.subjectId,
    subjectName: state.subjectName,
    minutes: Math.round(state.durationSeconds / 60),
    completionId: state.completionId,
    startedAt: state.startedAt,
    completedAt: focusEndAt,
    pauseCount: state.pauseCount,
    pausedSeconds: state.pausedSeconds,
    intention: state.intention,
  };
  const base = {
    ...state,
    save: { session, status: 'pending' },
    overlay: { subjectName: state.subjectName, minutes: session.minutes },
    notice: away ? 'away' : null,
    pauseStartedAt: null,
    completionId: null,
  };
  if (now >= breakEndAt) {
    // The break also elapsed while we were away — do not force a stale one.
    return { ...base, phase: 'break_complete', endAt: null, remainingMs: 0 };
  }
  return {
    ...base,
    phase: 'running_break',
    durationSeconds: BREAK_SECONDS,
    endAt: breakEndAt,
    remainingMs: breakEndAt - now,
  };
}

const focusExpired = (state, now) =>
  state.phase === 'running_focus' && now >= state.endAt;

export function reducer(state, event) {
  switch (event.type) {
    case 'SELECT_SUBJECT': {
      if (!isReady(state.phase)) return state;
      return {
        ...state,
        subjectId: event.subjectId,
        subjectName: event.subjectName,
      };
    }

    case 'SET_INTENTION': {
      if (!isReady(state.phase)) return state;
      return { ...state, intention: event.intention };
    }

    case 'START': {
      if (!isReady(state.phase)) return state;
      if (state.subjectId == null) return state;
      const duration = event.durationSeconds || FOCUS_SECONDS;
      return {
        ...state,
        phase: 'running_focus',
        durationSeconds: duration,
        startedAt: event.now,
        endAt: event.now + duration * 1000,
        remainingMs: duration * 1000,
        pauseCount: 0,
        pausedSeconds: 0,
        pauseStartedAt: null,
        completionId: event.completionId,
        overlay: null,
        notice: null,
      };
    }

    case 'PAUSE': {
      // A pause pressed at/after expiry must not defeat completion.
      if (focusExpired(state, event.now)) {
        return completeFocus(state, event.now, false);
      }
      if (state.phase === 'running_focus' || state.phase === 'running_break') {
        return {
          ...state,
          phase:
            state.phase === 'running_focus' ? 'paused_focus' : 'paused_break',
          remainingMs: Math.max(0, state.endAt - event.now),
          endAt: null,
          pauseCount:
            state.phase === 'running_focus'
              ? state.pauseCount + 1
              : state.pauseCount,
          pauseStartedAt: event.now,
        };
      }
      return state;
    }

    case 'RESUME': {
      if (state.phase !== 'paused_focus' && state.phase !== 'paused_break')
        return state;
      const pausedFor = state.pauseStartedAt
        ? Math.floor((event.now - state.pauseStartedAt) / 1000)
        : 0;
      return {
        ...state,
        phase:
          state.phase === 'paused_focus' ? 'running_focus' : 'running_break',
        endAt: event.now + state.remainingMs,
        pausedSeconds: state.pausedSeconds + Math.max(0, pausedFor),
        pauseStartedAt: null,
      };
    }

    case 'RESET': {
      // Reset never saves an incomplete session (assignment T3) — but if the
      // focus had already expired, completion wins first, then we go idle.
      let s = state;
      if (focusExpired(s, event.now)) {
        s = completeFocus(s, event.now, false);
      }
      return {
        ...initialState,
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        intention: s.intention,
        save: s.save, // a pending save must survive a reset
        notice: 'reset',
      };
    }

    case 'FOCUS_ELAPSED': {
      if (state.phase !== 'running_focus') return state;
      return completeFocus(state, event.now, Boolean(event.away));
    }

    case 'SAVE_SUCCEEDED': {
      if (!state.save) return state;
      return { ...state, save: null };
    }

    case 'SAVE_FAILED': {
      if (!state.save) return state;
      return { ...state, save: { ...state.save, status: 'queued' } };
    }

    case 'BREAK_ELAPSED': {
      if (state.phase !== 'running_break') return state;
      return {
        ...state,
        phase: 'break_complete',
        endAt: null,
        remainingMs: 0,
        notice: state.notice === 'away' ? 'away' : 'break_finished',
      };
    }

    case 'SKIP_BREAK': {
      if (state.phase !== 'running_break' && state.phase !== 'paused_break')
        return state;
      return {
        ...state,
        phase: 'break_complete',
        endAt: null,
        remainingMs: 0,
        notice: 'break_finished',
      };
    }

    case 'CLEAR_OVERLAY': {
      return { ...state, overlay: null };
    }

    default:
      return state;
  }
}

/** Reconcile a restored record against current wall-clock time. */
export function reconcile(state, now) {
  if (!state) return initialState;
  if (state.phase === 'running_focus' && now >= state.endAt) {
    return completeFocus(state, now, true);
  }
  if (state.phase === 'running_break' && now >= state.endAt) {
    return reducer(state, { type: 'BREAK_ELAPSED', now });
  }
  return state;
}
