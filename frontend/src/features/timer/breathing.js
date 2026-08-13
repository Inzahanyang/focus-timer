// Guided Break breathing (design: "Focus leaves a contour. Rest lets it
// breathe."). The breath phase is DERIVED from the break's elapsed time —
// the same wall-clock source as the timer itself — so pausing freezes the
// breath, refreshing restores mid-cycle, and background tabs resync free
// of any extra bookkeeping.

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

// Guided/Quiet preference — remembered per device.
const PREF_KEY = 'focus-atlas.break-guide.v1';

export function isGuideEnabled() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'quiet';
  } catch {
    return true;
  }
}

export function setGuideEnabled(enabled) {
  try {
    if (enabled) localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, 'quiet');
  } catch {
    /* ignore */
  }
}
