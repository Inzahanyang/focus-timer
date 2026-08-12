// Pure terrain math — extracted so the week-boundary and bucketing rules
// are unit-testable (Codex stats audit MAJOR-1 / MINOR-3).
//
// Approximation note: a session is drawn as one continuous span ending at
// its completion time. Pause gaps inside a session are not stored per
// interval, so the hourly shape is an honest approximation; the per-day
// totals still match the session's real minutes.

export const BUCKETS_PER_DAY = 24;
export const WEEK_BUCKETS = 7 * BUCKETS_PER_DAY;

/** Local Monday 00:00 of the week containing `now`, and the next Monday.
    Built via the Date constructor so DST weeks keep real local hours. */
export function weekBoundsLocal(now = new Date()) {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7)
  );
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 7
  );
  return { start, end };
}

/**
 * Distribute each session's minutes across the local hours it spanned,
 * CLIPPED to [weekStart, weekEnd) — a session that ends Monday 00:10
 * must not paint "this week's Sunday" with last week's minutes.
 *
 * Returns:
 *   flat: 168 linear buckets (Mon 00h .. Sun 23h) of minutes
 *   dominant: per-day Map(subjectId -> minutes) for fill colors
 */
export function bucketize(sessions, weekStart, weekEnd) {
  const flat = new Array(WEEK_BUCKETS).fill(0);
  const dominant = Array.from({ length: 7 }, () => new Map());

  for (const session of sessions) {
    const end = new Date(session.created_at);
    const rawStart = new Date(end.getTime() - session.duration * 60_000);
    let cursor = rawStart < weekStart ? new Date(weekStart) : rawStart;
    const clippedEnd = end > weekEnd ? weekEnd : end;
    if (cursor >= clippedEnd) continue;

    while (cursor < clippedEnd) {
      const hourEnd = new Date(cursor);
      hourEnd.setMinutes(60, 0, 0);
      const sliceEnd = hourEnd < clippedEnd ? hourEnd : clippedEnd;
      const minutes = (sliceEnd - cursor) / 60_000;
      const day = (cursor.getDay() + 6) % 7; // Mon=0
      flat[day * BUCKETS_PER_DAY + cursor.getHours()] += minutes;
      const tally = dominant[day];
      tally.set(
        session.subject_id,
        (tally.get(session.subject_id) || 0) + minutes
      );
      cursor = sliceEnd;
    }
  }
  return { flat, dominant };
}

/** Linear smoothing over the whole week timeline. No wrap: Monday 00h has
    no left neighbor and Sunday 23h no right neighbor — midnight ridges
    never leak to the other end of the same day. */
export function smoothWeek(flat) {
  return flat.map((value, index) => {
    const prev = flat[index - 1] ?? 0;
    const next = flat[index + 1] ?? 0;
    return (prev + value * 2 + next) / 4;
  });
}

/** Per-day minute totals from the RAW buckets — the accessibility summary
    must describe exactly what the terrain shows. */
export function dayTotals(flat) {
  return Array.from({ length: 7 }, (_, day) => {
    let sum = 0;
    for (let hour = 0; hour < BUCKETS_PER_DAY; hour++) {
      sum += flat[day * BUCKETS_PER_DAY + hour];
    }
    return Math.round(sum);
  });
}
