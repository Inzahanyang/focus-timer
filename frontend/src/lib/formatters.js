// Display language: English months, 24-hour clock (PRODUCT_SPEC §3).
// Calculations always use the browser's local timezone.

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** 1500 -> "25:00" */
export function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Date -> "Aug 12, 2026 · 09:25" (local time) */
export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${hh}:${mm}`;
}

/** Date -> "AUG 12" (history date headers) */
export function formatDayHeader(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${MONTHS[d.getMonth()].toUpperCase()} ${d.getDate()}`;
}

/** Geological subject color, deterministic by id (DESIGN_SYSTEM §2). */
export function subjectColorVar(subjectId) {
  const index = ((subjectId - 1) % 8 + 8) % 8 + 1;
  return `var(--geo-${index})`;
}
