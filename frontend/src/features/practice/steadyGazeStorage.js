// Steady Gaze persistence — versioned, validated, local only (never the
// server). Two records: the active practice and the remembered settings.

import {
  GAZE_DURATIONS_S,
  initialState,
  STAGE_ORDER,
} from './steadyGazeMachine';

const PRACTICE_KEY = 'focus-atlas.steady-gaze.v1';
const SETTINGS_KEY = 'focus-atlas.steady-gaze-settings.v1';

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

const VALID_TARGETS = ['virtual', 'physical'];
const VALID_SOUND = ['cues', 'ambient', 'silent'];

function isValidPractice(state) {
  if (!state || typeof state !== 'object') return false;
  if (!STAGE_ORDER.includes(state.stage)) return false; // only live stages persist
  if (!VALID_TARGETS.includes(state.target)) return false;
  if (!VALID_SOUND.includes(state.soundMode)) return false;
  if (!GAZE_DURATIONS_S.includes(state.gazeDurationS)) return false;
  if (state.status === 'running') return isFiniteNumber(state.endAt);
  if (state.status === 'paused')
    return isFiniteNumber(state.remainingMs) && state.remainingMs > 0;
  return false;
}

export function loadPracticeRecord() {
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (record.version !== 1 || !isValidPractice(record.state)) {
      localStorage.removeItem(PRACTICE_KEY);
      return null;
    }
    return record.state;
  } catch {
    try {
      localStorage.removeItem(PRACTICE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function persistPracticeRecord(state) {
  try {
    if (state && STAGE_ORDER.includes(state.stage)) {
      localStorage.setItem(
        PRACTICE_KEY,
        JSON.stringify({ version: 1, state })
      );
    } else {
      localStorage.removeItem(PRACTICE_KEY);
    }
  } catch {
    /* storage unavailable — the in-memory practice still works */
  }
}

export function clearPracticeRecord() {
  try {
    localStorage.removeItem(PRACTICE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { seenIntro: false };
    const parsed = JSON.parse(raw);
    return {
      seenIntro: parsed.seenIntro === true,
      target: VALID_TARGETS.includes(parsed.target)
        ? parsed.target
        : initialState.target,
      gazeDurationS: GAZE_DURATIONS_S.includes(parsed.gazeDurationS)
        ? parsed.gazeDurationS
        : initialState.gazeDurationS,
      soundMode: VALID_SOUND.includes(parsed.soundMode)
        ? parsed.soundMode
        : initialState.soundMode,
    };
  } catch {
    return { seenIntro: false };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
