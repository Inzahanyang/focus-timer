import { describe, expect, it } from 'vitest';
import {
  BUCKETS_PER_DAY,
  bucketize,
  dayTotals,
  smoothWeek,
  weekBoundsLocal,
  WEEK_BUCKETS,
} from './terrainMath';

// Fixed local week: Mon 2026-08-10 00:00 .. Mon 2026-08-17 00:00
const WEEK_START = new Date(2026, 7, 10, 0, 0, 0);
const WEEK_END = new Date(2026, 7, 17, 0, 0, 0);

const session = (endLocal, duration, subjectId = 1) => ({
  created_at: endLocal.toISOString(),
  duration,
  subject_id: subjectId,
});

describe('weekBoundsLocal', () => {
  it('returns local Monday to next Monday', () => {
    const { start, end } = weekBoundsLocal(new Date(2026, 7, 12, 14, 30));
    expect(start.getTime()).toBe(WEEK_START.getTime());
    expect(end.getTime()).toBe(WEEK_END.getTime());
    expect(start.getDay()).toBe(1); // Monday
  });

  it('a Monday itself belongs to its own week', () => {
    const { start } = weekBoundsLocal(new Date(2026, 7, 10, 0, 30));
    expect(start.getTime()).toBe(WEEK_START.getTime());
  });
});

describe('bucketize clipping (audit MAJOR-1)', () => {
  it('a session ending Monday 00:10 never paints this week\'s Sunday', () => {
    // 25-minute session ending Mon 00:10 — 15 minutes belong to LAST week.
    const { flat } = bucketize(
      [session(new Date(2026, 7, 10, 0, 10), 25)],
      WEEK_START,
      WEEK_END
    );
    const sundayRow = flat.slice(6 * BUCKETS_PER_DAY);
    expect(sundayRow.every((v) => v === 0)).toBe(true);
    expect(flat[0]).toBe(10); // only Monday 00h gets the clipped 10 minutes
    expect(flat.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('midnight-spanning session splits between the two days', () => {
    // Tue 23:50 -> Wed 00:15 (25 min ending Wed 00:15)
    const { flat } = bucketize(
      [session(new Date(2026, 7, 12, 0, 15), 25)],
      WEEK_START,
      WEEK_END
    );
    const tue23 = flat[1 * BUCKETS_PER_DAY + 23];
    const wed00 = flat[2 * BUCKETS_PER_DAY + 0];
    expect(tue23).toBe(10);
    expect(wed00).toBe(15);
    // no phantom ridge at Tue 00h or Wed 23h
    expect(flat[1 * BUCKETS_PER_DAY]).toBe(0);
    expect(flat[2 * BUCKETS_PER_DAY + 23]).toBe(0);
  });

  it('minutes are conserved for fully in-week sessions', () => {
    const { flat } = bucketize(
      [
        session(new Date(2026, 7, 11, 10, 20), 50),
        session(new Date(2026, 7, 14, 21, 5), 25),
      ],
      WEEK_START,
      WEEK_END
    );
    expect(flat.reduce((a, b) => a + b, 0)).toBe(75);
  });

  it('dominant subject per day follows the larger share', () => {
    const { dominant } = bucketize(
      [
        session(new Date(2026, 7, 11, 9, 0), 25, 1),
        session(new Date(2026, 7, 11, 11, 0), 50, 2),
      ],
      WEEK_START,
      WEEK_END
    );
    const tuesday = dominant[1];
    expect(tuesday.get(2)).toBe(50);
    expect(tuesday.get(1)).toBe(25);
  });
});

describe('smoothWeek (no wraparound)', () => {
  it('does not leak midnight values to the other end of the day', () => {
    const flat = new Array(WEEK_BUCKETS).fill(0);
    flat[2 * BUCKETS_PER_DAY + 0] = 60; // Wed 00h
    const smoothed = smoothWeek(flat);
    // neighbor Tue 23h receives smoothing spill (adjacent on the timeline)
    expect(smoothed[1 * BUCKETS_PER_DAY + 23]).toBeGreaterThan(0);
    // but Wed 23h — same day, other end — must stay at zero
    expect(smoothed[2 * BUCKETS_PER_DAY + 23]).toBe(0);
  });

  it('Monday 00h has no left neighbor', () => {
    const flat = new Array(WEEK_BUCKETS).fill(0);
    flat[0] = 40;
    const smoothed = smoothWeek(flat);
    expect(smoothed[WEEK_BUCKETS - 1]).toBe(0); // Sunday 23h untouched
  });
});

describe('dayTotals', () => {
  it('sums raw buckets per day for the accessibility summary', () => {
    const { flat } = bucketize(
      [session(new Date(2026, 7, 12, 0, 15), 25)], // Tue 10 + Wed 15
      WEEK_START,
      WEEK_END
    );
    const totals = dayTotals(flat);
    expect(totals).toEqual([0, 10, 15, 0, 0, 0, 0]);
  });
});
