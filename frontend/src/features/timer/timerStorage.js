// Versioned persistence for the active timer (DECISIONS D3, D22, D25).
// Schema v2: phase/remainingMs/outbox. v1 records (pre-release only, no
// real users existed) are discarded rather than migrated — see D25.
// A record is kept while a phase is live OR the outbox is non-empty.

import { initialState } from './timerMachine';

const KEY = 'focus-atlas.timer.v1'; // storage key is stable; version field gates schema
const VERSION = 2;

const PHASES = [
  'idle_focus',
  'running_focus',
  'paused_focus',
  'running_break',
  'paused_break',
  'break_complete',
];

const LIVE_PHASES = [
  'running_focus',
  'paused_focus',
  'running_break',
  'paused_break',
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);

function isValidOutboxItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.status !== 'pending' && item.status !== 'queued') return false;
  const session = item.session;
  if (!session || typeof session !== 'object') return false;
  if (typeof session.completionId !== 'string') return false;
  if (!UUID_PATTERN.test(session.completionId)) return false;
  if (!isFiniteNumber(session.minutes) || session.minutes <= 0) return false;
  if (session.subjectId == null) return false;
  return true;
}

/** Are the phase-specific timing fields trustworthy? */
function phaseFieldsValid(state) {
  if (!PHASES.includes(state.phase)) return false;
  if (state.phase === 'running_focus' || state.phase === 'running_break') {
    if (!isFiniteNumber(state.endAt)) return false;
  }
  if (state.phase === 'paused_focus' || state.phase === 'paused_break') {
    // 0ms paused would freeze at 00:00 forever — treat as corrupted.
    if (!isFiniteNumber(state.remainingMs) || state.remainingMs <= 0)
      return false;
  }
  if (LIVE_PHASES.includes(state.phase)) {
    if (!isFiniteNumber(state.durationSeconds) || state.durationSeconds <= 0)
      return false;
  }
  if (state.phase === 'running_focus' || state.phase === 'paused_focus') {
    if (state.subjectId == null) return false;
    if (typeof state.completionId !== 'string') return false;
  }
  return true;
}

/**
 * Salvage what can be salvaged: valid outbox items must survive even when
 * the phase fields are corrupted (the save is owed to the server).
 */
function sanitize(state) {
  if (!state || typeof state !== 'object') return null;
  const outbox = Array.isArray(state.outbox)
    ? state.outbox.filter(isValidOutboxItem)
    : [];

  if (!phaseFieldsValid(state)) {
    return outbox.length > 0 ? { ...initialState, outbox } : null;
  }

  const shouldRestore = LIVE_PHASES.includes(state.phase) || outbox.length > 0;
  if (!shouldRestore) return null;
  return { ...state, outbox };
}

export function loadTimerRecord() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (record.version !== VERSION) {
      // Unknown/old schema — remove so it can't corrupt a future load.
      localStorage.removeItem(KEY);
      return null;
    }
    const state = sanitize(record.state);
    if (!state) localStorage.removeItem(KEY);
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
    if (LIVE_PHASES.includes(state.phase) || state.outbox.length > 0) {
      localStorage.setItem(KEY, JSON.stringify({ version: VERSION, state }));
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // Storage full/unavailable — the in-memory timer still works.
  }
}
