// Steady Gaze (Trataka) state machine — pure, deliberately separate from
// the focus timer's machine (brief §5). Same wall-clock discipline:
// running truth is `endAt - now`, paused truth is `remainingMs`,
// intervals only repaint. The practice is never sent to the server.
//
// Product boundary (brief §1): steady attention, not endurance —
// no records, no streaks, no achievements.

export const STAGE_ORDER = ['settle', 'gaze', 'eyes_closed', 'rest'];

export const FIXED_STAGE_SECONDS = {
  settle: 10,
  eyes_closed: 30,
  rest: 20,
};

export const GAZE_DURATIONS_S = [30, 60, 180, 300]; // 30s default; 5min never emphasized

export function stageSeconds(stage, gazeDurationS) {
  return stage === 'gaze' ? gazeDurationS : FIXED_STAGE_SECONDS[stage];
}

export const initialState = {
  stage: 'setup', // setup | settle | gaze | eyes_closed | rest | complete
  status: null, // running | paused (only during timed stages)
  target: 'virtual', // virtual | physical
  gazeDurationS: 30,
  soundMode: 'cues', // cues | ambient | silent
  endAt: null,
  remainingMs: null,
  practiceStartedAt: null,
};

const isTimedStage = (stage) => STAGE_ORDER.includes(stage);

/** Seconds to display for the current stage. */
export function deriveRemaining(state, now) {
  if (!isTimedStage(state.stage)) return 0;
  const ms =
    state.status === 'running'
      ? Math.max(0, state.endAt - now)
      : state.remainingMs || 0;
  return Math.ceil(ms / 1000);
}

function enterStage(state, stage, startAt) {
  const duration = stageSeconds(stage, state.gazeDurationS) * 1000;
  return {
    ...state,
    stage,
    status: 'running',
    endAt: startAt + duration,
    remainingMs: duration,
  };
}

/** Advance from an expired stage. Anchored at the theoretical end — a
    throttled tab never shifts the schedule. Walks multiple stages when
    the user was away long enough (brief §5). */
function advance(state, now) {
  let current = state;
  while (
    isTimedStage(current.stage) &&
    current.status === 'running' &&
    now >= current.endAt
  ) {
    const index = STAGE_ORDER.indexOf(current.stage);
    const next = STAGE_ORDER[index + 1];
    if (!next) {
      return {
        ...current,
        stage: 'complete',
        status: null,
        endAt: null,
        remainingMs: null,
      };
    }
    current = enterStage(current, next, current.endAt);
  }
  return current;
}

export function reducer(state, event) {
  switch (event.type) {
    case 'CONFIGURE': {
      // setup-screen changes only
      if (state.stage !== 'setup') return state;
      const next = { ...state };
      if (event.target != null) next.target = event.target;
      if (event.gazeDurationS != null) {
        if (!GAZE_DURATIONS_S.includes(event.gazeDurationS)) return state;
        next.gazeDurationS = event.gazeDurationS;
      }
      if (event.soundMode != null) next.soundMode = event.soundMode;
      return next;
    }

    case 'BEGIN': {
      if (state.stage !== 'setup') return state;
      return {
        ...enterStage(
          { ...state, practiceStartedAt: event.now },
          'settle',
          event.now
        ),
      };
    }

    case 'PAUSE': {
      if (!isTimedStage(state.stage) || state.status !== 'running')
        return state;
      // Expiry beats the command — pausing on the final frame advances.
      if (event.now >= state.endAt) return advance(state, event.now);
      return {
        ...state,
        status: 'paused',
        remainingMs: state.endAt - event.now,
        endAt: null,
      };
    }

    case 'RESUME': {
      if (!isTimedStage(state.stage) || state.status !== 'paused')
        return state;
      return {
        ...state,
        status: 'running',
        endAt: event.now + state.remainingMs,
      };
    }

    case 'STAGE_ELAPSED': {
      if (!isTimedStage(state.stage) || state.status !== 'running')
        return state;
      if (event.now < state.endAt) return state;
      return advance(state, event.now);
    }

    case 'PRACTICE_AGAIN': {
      if (state.stage !== 'complete') return state;
      return {
        ...initialState,
        target: state.target,
        gazeDurationS: state.gazeDurationS,
        soundMode: state.soundMode,
      };
    }

    case 'END': {
      // End is always available and always returns to setup-cleared state;
      // the component clears storage and audio (brief §5).
      return {
        ...initialState,
        target: state.target,
        gazeDurationS: state.gazeDurationS,
        soundMode: state.soundMode,
      };
    }

    default:
      return state;
  }
}

/** Restore a persisted record against current wall-clock time. Never
    shows a stale stage: advances through everything that already passed,
    or lands on complete. */
export function reconcile(state, now) {
  if (!state) return initialState;
  if (
    isTimedStage(state.stage) &&
    state.status === 'running' &&
    now >= state.endAt
  ) {
    return advance(state, now);
  }
  return state;
}
