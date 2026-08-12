// Versioned persistence for the active timer (DECISIONS D3, master plan §10.2).
// A record is kept while a phase is live OR a save is still owed —
// a pending completion must survive reloads until it reaches the server.

const KEY = 'focus-atlas.timer.v1';

const LIVE_PHASES = [
  'running_focus',
  'paused_focus',
  'running_break',
  'paused_break',
];

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** Corrupted records must never produce NaN timers — validate per phase. */
function isValidState(state) {
  if (!state || typeof state !== 'object') return false;

  if (state.phase === 'running_focus' || state.phase === 'running_break') {
    if (!isFiniteNumber(state.endAt)) return false;
  }
  if (state.phase === 'paused_focus' || state.phase === 'paused_break') {
    if (!isFiniteNumber(state.remainingMs)) return false;
  }
  if (LIVE_PHASES.includes(state.phase) || state.phase === 'break_complete') {
    if (!isFiniteNumber(state.durationSeconds) || state.durationSeconds <= 0)
      return false;
  }
  if (state.save != null) {
    const { session, status } = state.save;
    if (status !== 'pending' && status !== 'queued') return false;
    if (!session || typeof session !== 'object') return false;
    if (!isFiniteNumber(session.minutes) || session.minutes <= 0) return false;
    if (session.subjectId == null || !session.completionId) return false;
  }
  return true;
}

export function loadTimerRecord() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (record.version !== 1) return null;
    const state = record.state;
    const shouldRestore =
      state &&
      (LIVE_PHASES.includes(state.phase) || state.save != null);
    if (!shouldRestore || !isValidState(state)) {
      localStorage.removeItem(KEY); // broken/stale records recover to idle
      return null;
    }
    return state;
  } catch {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function persistTimerState(state) {
  try {
    if (LIVE_PHASES.includes(state.phase) || state.save != null) {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, state }));
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // Storage full/unavailable — the in-memory timer still works.
  }
}
