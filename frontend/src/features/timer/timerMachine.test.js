import { describe, expect, it } from 'vitest';
import {
  BREAK_SECONDS,
  FOCUS_SECONDS,
  deriveRemaining,
  initialState,
  reconcile,
  reducer,
} from './timerMachine';

const T0 = 1_800_000_000_000; // fixed wall clock, no Date.now() in tests
const FOCUS_MS = FOCUS_SECONDS * 1000;
const BREAK_MS = BREAK_SECONDS * 1000;

function startedState(now = T0) {
  let s = reducer(initialState, {
    type: 'SELECT_SUBJECT',
    subjectId: 1,
    subjectName: 'Reading',
  });
  s = reducer(s, {
    type: 'START',
    now,
    completionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  });
  return s;
}

function breakState() {
  // focus started at T0, elapsed exactly at endAt
  const s = startedState();
  return reducer(s, { type: 'FOCUS_ELAPSED', now: T0 + FOCUS_MS });
}

describe('start / pause / resume / reset', () => {
  it('does not start without a subject', () => {
    const s = reducer(initialState, { type: 'START', now: T0, completionId: 'x' });
    expect(s.phase).toBe('idle_focus');
  });

  it('starts a 25-minute focus with endAt truth', () => {
    const s = startedState();
    expect(s.phase).toBe('running_focus');
    expect(s.endAt).toBe(T0 + FOCUS_MS);
    expect(deriveRemaining(s, T0)).toBe(FOCUS_SECONDS);
  });

  it('pause preserves exact remaining ms; resume rebuilds endAt', () => {
    let s = startedState();
    s = reducer(s, { type: 'PAUSE', now: T0 + 90_400 });
    expect(s.phase).toBe('paused_focus');
    expect(s.remainingMs).toBe(FOCUS_MS - 90_400);
    expect(s.endAt).toBeNull();
    s = reducer(s, { type: 'RESUME', now: T0 + 200_000 });
    expect(s.phase).toBe('running_focus');
    expect(s.endAt).toBe(T0 + 200_000 + FOCUS_MS - 90_400);
    expect(s.pausedSeconds).toBe(Math.floor((200_000 - 90_400) / 1000));
  });

  it('reset before expiry never saves and keeps subject/intention', () => {
    let s = startedState();
    s = reducer(s, { type: 'RESET', now: T0 + 5000 });
    expect(s.phase).toBe('idle_focus');
    expect(s.outbox).toHaveLength(0);
    expect(s.subjectId).toBe(1);
    expect(s.notice).toBe('reset');
  });
});

describe('expiry beats user commands (audit round 2)', () => {
  // table: [label, offset from endAt, expectCompleted]
  const cases = [
    ['1ms before endAt', -1, false],
    ['exactly at endAt', 0, true],
    ['1ms after endAt', 1, true],
  ];

  for (const [label, offset, completed] of cases) {
    it(`focus PAUSE ${label} → ${completed ? 'completes' : 'pauses'}`, () => {
      const s = startedState();
      const out = reducer(s, { type: 'PAUSE', now: T0 + FOCUS_MS + offset });
      if (completed) {
        expect(out.phase).toBe('running_break');
        expect(out.outbox).toHaveLength(1);
        expect(out.overlay).not.toBeNull();
      } else {
        expect(out.phase).toBe('paused_focus');
        expect(out.outbox).toHaveLength(0);
      }
    });

    it(`focus RESET ${label} → ${completed ? 'completes' : 'clears'}`, () => {
      const s = startedState();
      const out = reducer(s, { type: 'RESET', now: T0 + FOCUS_MS + offset });
      if (completed) {
        // completion wins entirely: break + overlay, not a silent discard
        expect(out.phase).toBe('running_break');
        expect(out.outbox).toHaveLength(1);
        expect(out.overlay).not.toBeNull();
      } else {
        expect(out.phase).toBe('idle_focus');
        expect(out.outbox).toHaveLength(0);
      }
    });
  }

  it('break PAUSE at/after expiry completes the break, never 00:00 paused', () => {
    const b = breakState();
    for (const offset of [0, 1]) {
      const out = reducer(b, { type: 'PAUSE', now: b.endAt + offset });
      expect(out.phase).toBe('break_complete');
    }
    const before = reducer(b, { type: 'PAUSE', now: b.endAt - 1 });
    expect(before.phase).toBe('paused_break');
    expect(before.remainingMs).toBeGreaterThan(0);
  });
});

describe('completion, break anchoring, outbox', () => {
  it('focus completion enters the break anchored at theoretical focus end', () => {
    const s = startedState();
    // completion detected 40s late (throttled tab)
    const out = reducer(s, { type: 'FOCUS_ELAPSED', now: T0 + FOCUS_MS + 40_000 });
    expect(out.phase).toBe('running_break');
    expect(out.endAt).toBe(T0 + FOCUS_MS + BREAK_MS); // not now + 5min
    expect(out.outbox[0].session.completedAt).toBe(T0 + FOCUS_MS);
    expect(out.outbox[0].session.minutes).toBe(25);
  });

  it('duplicate FOCUS_ELAPSED is a no-op (exactly-once at machine level)', () => {
    const s = startedState();
    const once = reducer(s, { type: 'FOCUS_ELAPSED', now: T0 + FOCUS_MS });
    const twice = reducer(once, { type: 'FOCUS_ELAPSED', now: T0 + FOCUS_MS + 1 });
    expect(twice).toBe(once);
    expect(twice.outbox).toHaveLength(1);
  });

  it('a second completion never overwrites an unsaved first session', () => {
    // session A completes but its save stays unresolved
    let s = breakState();
    expect(s.outbox.map((i) => i.session.completionId)).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ]);
    // user skips break, starts session B, B completes too
    s = reducer(s, { type: 'SKIP_BREAK' });
    s = reducer(s, {
      type: 'START',
      now: T0 + 10_000_000,
      completionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    s = reducer(s, { type: 'FOCUS_ELAPSED', now: T0 + 10_000_000 + FOCUS_MS });
    expect(s.outbox).toHaveLength(2);
    // A's success removes only A
    s = reducer(s, {
      type: 'SAVE_SUCCEEDED',
      completionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(s.outbox.map((i) => i.session.completionId)).toEqual([
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ]);
  });

  it('SAVE_FAILED marks only its item queued; RETRY_SAVES re-pends it', () => {
    let s = breakState();
    s = reducer(s, {
      type: 'SAVE_FAILED',
      completionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(s.outbox[0].status).toBe('queued');
    s = reducer(s, { type: 'RETRY_SAVES' });
    expect(s.outbox[0].status).toBe('pending');
  });

  it('outbox survives RESET', () => {
    let s = breakState();
    s = reducer(s, { type: 'RESET', now: s.endAt - 1000 });
    expect(s.phase).toBe('idle_focus');
    expect(s.outbox).toHaveLength(1);
  });
});

describe('reconcile after absence', () => {
  it('restores a still-running focus untouched', () => {
    const s = startedState();
    expect(reconcile(s, T0 + 60_000)).toBe(s);
  });

  it('completes an elapsed focus exactly once with away notice', () => {
    const s = startedState();
    const out = reconcile(s, T0 + FOCUS_MS + 60_000);
    expect(out.phase).toBe('running_break');
    expect(out.notice).toBe('away');
    expect(out.outbox).toHaveLength(1);
  });

  it('skips a stale break entirely when both periods elapsed', () => {
    const s = startedState();
    const out = reconcile(s, T0 + FOCUS_MS + BREAK_MS + 1000);
    expect(out.phase).toBe('break_complete');
    expect(out.outbox).toHaveLength(1);
  });

  it('finishes an elapsed break', () => {
    const b = breakState();
    const out = reconcile(b, b.endAt + 5000);
    expect(out.phase).toBe('break_complete');
  });
});
