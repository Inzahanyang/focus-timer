// Breathing (design: "Focus leaves a contour. Rest lets it breathe.").
// The breath phase is DERIVED from elapsed time — the same wall-clock
// discipline as the timer — so pausing freezes the breath, refreshing
// restores mid-cycle, and background tabs resync without bookkeeping.
//
// Two consumers share this module (D33):
//   Guided Break        — opt-in guide inside the automatic 5-minute break
//   Standalone breathing— "Take a breathing pause": user-initiated,
//                          subject-free, never saved as a focus session

export const BREATH_CYCLE_MS = 12_000;
const INHALE_MS = 4_000;
const HOLD_MS = 2_000;
const EXHALE_MS = 6_000; // longer exhale reads calmer than symmetric cycles

const MAX_SCALE = 1.05;

/** elapsedMs (>=0, any size) -> { phase, label, scale } */
export function breathState(elapsedMs) {
  const safe = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const t = safe % BREATH_CYCLE_MS;

  if (t < INHALE_MS) {
    return {
      phase: 'in',
      label: 'Breathe in',
      scale: 1 + (MAX_SCALE - 1) * (t / INHALE_MS),
    };
  }
  if (t < INHALE_MS + HOLD_MS) {
    return { phase: 'hold', label: 'Hold', scale: MAX_SCALE };
  }
  return {
    phase: 'out',
    label: 'Breathe out',
    scale:
      MAX_SCALE - (MAX_SCALE - 1) * ((t - INHALE_MS - HOLD_MS) / EXHALE_MS),
  };
}

// Break-guide preference. OPT-IN: the automatic break defaults to Quiet —
// the user chooses to breathe; the app never starts it for them (D33).
const PREF_KEY = 'focus-atlas.break-guide.v1';

export function isGuideEnabled() {
  try {
    return localStorage.getItem(PREF_KEY) === 'guided';
  } catch {
    return false;
  }
}

export function setGuideEnabled(enabled) {
  try {
    if (enabled) localStorage.setItem(PREF_KEY, 'guided');
    else localStorage.removeItem(PREF_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------
// Standalone breathing persistence — separate from the focus timer's
// record; a breathing pause survives a refresh but never touches
// sessions, stats, or subjects.

const BREATHING_KEY = 'focus-atlas.breathing.v1';
const MAX_BREATHING_SECONDS = 600;

const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);

function isValidBreathing(record) {
  if (!record || typeof record !== 'object') return false;
  if (!isFiniteNumber(record.durationS)) return false;
  if (record.durationS <= 0 || record.durationS > MAX_BREATHING_SECONDS)
    return false;
  if (record.status === 'running') return isFiniteNumber(record.endAt);
  if (record.status === 'paused')
    return isFiniteNumber(record.remainingMs) && record.remainingMs > 0;
  return false;
}

export function loadBreathingRecord() {
  try {
    const raw = localStorage.getItem(BREATHING_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (record.version !== 1 || !isValidBreathing(record.state)) {
      localStorage.removeItem(BREATHING_KEY);
      return null;
    }
    return record.state;
  } catch {
    try {
      localStorage.removeItem(BREATHING_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function persistBreathingRecord(state) {
  try {
    if (state && isValidBreathing(state)) {
      localStorage.setItem(
        BREATHING_KEY,
        JSON.stringify({ version: 1, state })
      );
    } else {
      localStorage.removeItem(BREATHING_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function clearBreathingRecord() {
  try {
    localStorage.removeItem(BREATHING_KEY);
  } catch {
    /* ignore */
  }
}
