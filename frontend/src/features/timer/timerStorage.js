// Versioned persistence for the active timer (DECISIONS D3, master plan §10.2).
// Only live sessions are stored; idle states clear the record.

const KEY = 'focus-atlas.timer.v1';

const LIVE_STATUSES = [
  'running_focus',
  'paused_focus',
  'saving_focus',
  'running_break',
  'paused_break',
];

export function loadTimerRecord() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (record.version !== 1 || !record.state) return null;
    if (!LIVE_STATUSES.includes(record.state.status)) return null;
    return record.state;
  } catch {
    return null;
  }
}

export function persistTimerState(state) {
  try {
    if (LIVE_STATUSES.includes(state.status)) {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, state }));
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // Storage full/unavailable — the in-memory timer still works.
  }
}
