// Focus Atlas timer state machine.
//
// The single most important rule (DECISIONS D3): displayed time is DERIVED
// from absolute wall-clock timestamps. `endAt` is the truth while running;
// `remainingSeconds` is the truth while paused/idle. Intervals only repaint.
//
// All transitions are pure. Invalid events are ignored (return same state),
// which is what makes completion exactly-once at the machine level: a second
// FOCUS_ELAPSED simply finds the machine no longer in `running_focus`.

export const FOCUS_SECONDS = 25 * 60;
export const BREAK_SECONDS = 5 * 60;

export const initialState = {
  status: 'idle_focus',
  // idle_focus | running_focus | paused_focus | saving_focus
  // running_break | paused_break | break_complete
  subjectId: null,
  subjectName: null,
  intention: '',
  durationSeconds: FOCUS_SECONDS,
  endAt: null, // ms epoch, only while running
  remainingSeconds: FOCUS_SECONDS, // authoritative while paused/idle
  startedAt: null, // ms epoch of focus start
  pauseCount: 0,
  pausedSeconds: 0,
  pauseStartedAt: null,
  completionId: null, // UUID minted at START; the idempotency key
  breakEndAt: null, // theoretical break end = focus endAt + 5 min
  completedSession: null, // {subjectName, minutes} — drives the overlay
  completedWhileAway: false,
};

/** The derived truth. Call with Date.now() on every repaint. */
export function deriveRemaining(state, now) {
  if (state.status === 'running_focus' || state.status === 'running_break') {
    return Math.max(0, Math.ceil((state.endAt - now) / 1000));
  }
  return state.remainingSeconds;
}

export function modeFor(status) {
  if (
    status === 'running_focus' ||
    status === 'paused_focus' ||
    status === 'saving_focus'
  ) {
    return 'focus';
  }
  if (status === 'running_break' || status === 'paused_break') return 'break';
  return 'paper';
}

const READY_STATUSES = ['idle_focus', 'break_complete'];

export function reducer(state, event) {
  switch (event.type) {
    case 'SELECT_SUBJECT': {
      if (!READY_STATUSES.includes(state.status)) return state;
      return {
        ...state,
        subjectId: event.subjectId,
        subjectName: event.subjectName,
      };
    }

    case 'SET_INTENTION': {
      if (!READY_STATUSES.includes(state.status)) return state;
      return { ...state, intention: event.intention };
    }

    case 'START': {
      if (!READY_STATUSES.includes(state.status)) return state;
      if (state.subjectId == null) return state;
      const duration = event.durationSeconds || FOCUS_SECONDS;
      return {
        ...state,
        status: 'running_focus',
        durationSeconds: duration,
        startedAt: event.now,
        endAt: event.now + duration * 1000,
        remainingSeconds: duration,
        pauseCount: 0,
        pausedSeconds: 0,
        pauseStartedAt: null,
        completionId: event.completionId,
        breakEndAt: null,
        completedSession: null,
        completedWhileAway: false,
      };
    }

    case 'PAUSE': {
      if (state.status === 'running_focus') {
        return {
          ...state,
          status: 'paused_focus',
          remainingSeconds: deriveRemaining(state, event.now),
          endAt: null,
          pauseCount: state.pauseCount + 1,
          pauseStartedAt: event.now,
        };
      }
      if (state.status === 'running_break') {
        return {
          ...state,
          status: 'paused_break',
          remainingSeconds: deriveRemaining(state, event.now),
          endAt: null,
          pauseStartedAt: event.now,
        };
      }
      return state;
    }

    case 'RESUME': {
      if (state.status !== 'paused_focus' && state.status !== 'paused_break')
        return state;
      const pausedFor = state.pauseStartedAt
        ? Math.floor((event.now - state.pauseStartedAt) / 1000)
        : 0;
      return {
        ...state,
        status: state.status === 'paused_focus' ? 'running_focus' : 'running_break',
        endAt: event.now + state.remainingSeconds * 1000,
        pausedSeconds: state.pausedSeconds + Math.max(0, pausedFor),
        pauseStartedAt: null,
      };
    }

    case 'RESET': {
      // Reset never saves (assignment T3). Subject selection is preserved.
      return {
        ...initialState,
        subjectId: state.subjectId,
        subjectName: state.subjectName,
        intention: state.intention,
      };
    }

    case 'FOCUS_ELAPSED': {
      if (state.status !== 'running_focus') return state;
      // Anchor the break at the theoretical focus end, not at "now" —
      // if the tab was closed, the break still ends when it should have.
      const focusEndAt = state.endAt;
      return {
        ...state,
        status: 'saving_focus',
        remainingSeconds: 0,
        endAt: null,
        breakEndAt: focusEndAt + BREAK_SECONDS * 1000,
        completedSession: {
          subjectId: state.subjectId,
          subjectName: state.subjectName,
          minutes: Math.round(state.durationSeconds / 60),
          completionId: state.completionId,
          startedAt: state.startedAt,
          completedAt: focusEndAt,
          pauseCount: state.pauseCount,
          pausedSeconds: state.pausedSeconds,
          intention: state.intention,
        },
        completedWhileAway: Boolean(event.away),
      };
    }

    case 'SAVE_SUCCEEDED':
    case 'SAVE_QUEUED': {
      if (state.status !== 'saving_focus') return state;
      // If the theoretical break is already over (long absence), skip it.
      if (event.now >= state.breakEndAt) {
        return {
          ...state,
          status: 'break_complete',
          endAt: null,
          remainingSeconds: 0,
        };
      }
      return {
        ...state,
        status: 'running_break',
        durationSeconds: BREAK_SECONDS,
        endAt: state.breakEndAt,
        remainingSeconds: Math.ceil((state.breakEndAt - event.now) / 1000),
        pauseStartedAt: null,
      };
    }

    case 'BREAK_ELAPSED': {
      if (state.status !== 'running_break') return state;
      return {
        ...state,
        status: 'break_complete',
        endAt: null,
        remainingSeconds: 0,
      };
    }

    case 'SKIP_BREAK': {
      if (state.status !== 'running_break' && state.status !== 'paused_break')
        return state;
      return {
        ...state,
        status: 'break_complete',
        endAt: null,
        remainingSeconds: 0,
      };
    }

    case 'CLEAR_COMPLETION': {
      return { ...state, completedSession: null };
    }

    default:
      return state;
  }
}

/**
 * Reconcile a persisted record against current wall-clock time.
 * Called once on load; the returned state may still need the save flow
 * (status saving_focus), which the hook drives.
 */
export function reconcile(state, now) {
  if (!state) return initialState;

  if (state.status === 'running_focus' && now >= state.endAt) {
    // Focus elapsed while we were away — complete it exactly once.
    return reducer(state, { type: 'FOCUS_ELAPSED', now, away: true });
  }
  if (state.status === 'running_break' && now >= state.endAt) {
    return reducer(state, { type: 'BREAK_ELAPSED', now });
  }
  return state;
}
