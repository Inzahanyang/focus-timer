// Breathing (design: "Focus leaves a contour. Rest lets it breathe.").
// The breath phase is DERIVED from elapsed time — the same wall-clock
// discipline as the timer — so pausing freezes the breath, refreshing
// restores mid-cycle, and background tabs resync without bookkeeping.
//
// Sole consumer (D34): standalone breathing behind "Take a breathing
// pause" — user-initiated, subject-free, never saved as a focus session.
// The automatic break stays quiet; the app never breathes at the user.

export const BREATH_CYCLE_MS = 12_000;
const INHALE_MS = 4_000;
const HOLD_MS = 2_000;
const EXHALE_MS = 6_000; // longer exhale reads calmer than symmetric cycles

// Breathing must feel somatic, not decorative (design pass: guidance-
// forward). The easing lives HERE in the math — the screen only chases
// these derived values — so the inhale visibly swells early (ease-out),
// the hold is truly still, and the exhale settles long and soft
// (ease-in-out). `amount` is normalized 0..1; each contour layer applies
// its own amplitude for depth.

const easeOutQuad = (p) => p * (2 - p);
const easeInOutQuad = (p) =>
  p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;

/** elapsedMs (>=0, any size) -> { phase, label, amount } */
export function breathState(elapsedMs) {
  const safe = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  const t = safe % BREATH_CYCLE_MS;

  if (t < INHALE_MS) {
    return {
      phase: 'in',
      label: 'Breathe in',
      amount: easeOutQuad(t / INHALE_MS),
    };
  }
  if (t < INHALE_MS + HOLD_MS) {
    return { phase: 'hold', label: 'Hold', amount: 1 };
  }
  return {
    phase: 'out',
    label: 'Breathe out',
    amount: 1 - easeInOutQuad((t - INHALE_MS - HOLD_MS) / EXHALE_MS),
  };
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
