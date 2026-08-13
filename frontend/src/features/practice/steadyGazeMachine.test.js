import { describe, expect, it } from 'vitest';
import {
  deriveRemaining,
  GAZE_DURATIONS_S,
  initialState,
  reconcile,
  reducer,
  stageSeconds,
} from './steadyGazeMachine';

const T0 = 1_800_000_000_000;

const begin = (gazeDurationS = 30, overrides = {}) => {
  let s = { ...initialState, ...overrides };
  s = reducer(s, { type: 'CONFIGURE', gazeDurationS });
  return reducer(s, { type: 'BEGIN', now: T0 });
};

/** End-of-stage moments measured from T0 for a given gaze duration. */
const ends = (gazeS) => {
  const settle = T0 + 10_000;
  const gaze = settle + gazeS * 1000;
  const eyes = gaze + 30_000;
  const rest = eyes + 20_000;
  return { settle, gaze, eyes, rest };
};

describe('flow', () => {
  it('walks setup -> settle -> gaze -> eyes_closed -> rest -> complete', () => {
    const e = ends(30);
    let s = begin(30);
    expect(s.stage).toBe('settle');
    expect(deriveRemaining(s, T0)).toBe(10);

    s = reducer(s, { type: 'STAGE_ELAPSED', now: e.settle });
    expect(s.stage).toBe('gaze');
    expect(deriveRemaining(s, e.settle)).toBe(30);

    s = reducer(s, { type: 'STAGE_ELAPSED', now: e.gaze });
    expect(s.stage).toBe('eyes_closed');
    s = reducer(s, { type: 'STAGE_ELAPSED', now: e.eyes });
    expect(s.stage).toBe('rest');
    s = reducer(s, { type: 'STAGE_ELAPSED', now: e.rest });
    expect(s.stage).toBe('complete');
    expect(s.status).toBeNull();
  });

  it('honors every gaze duration option', () => {
    for (const gazeS of GAZE_DURATIONS_S) {
      const s = reducer(begin(gazeS), {
        type: 'STAGE_ELAPSED',
        now: T0 + 10_000,
      });
      expect(s.stage).toBe('gaze');
      expect(deriveRemaining(s, T0 + 10_000)).toBe(gazeS);
      expect(stageSeconds('gaze', gazeS)).toBe(gazeS);
    }
  });

  it('rejects durations outside the allowed set', () => {
    const s = reducer(initialState, { type: 'CONFIGURE', gazeDurationS: 999 });
    expect(s.gazeDurationS).toBe(30);
  });
});

describe('pause / resume / expiry', () => {
  it('pause preserves remaining ms in every timed stage', () => {
    let s = begin(60);
    s = reducer(s, { type: 'STAGE_ELAPSED', now: T0 + 10_000 }); // gaze
    s = reducer(s, { type: 'PAUSE', now: T0 + 10_000 + 21_500 });
    expect(s.status).toBe('paused');
    expect(s.remainingMs).toBe(60_000 - 21_500);

    s = reducer(s, { type: 'RESUME', now: T0 + 100_000 });
    expect(s.status).toBe('running');
    expect(s.endAt).toBe(T0 + 100_000 + 38_500);
  });

  it('expiry beats a pause on the final frame', () => {
    const e = ends(30);
    let s = begin(30);
    s = reducer(s, { type: 'PAUSE', now: e.settle }); // exactly at expiry
    expect(s.stage).toBe('gaze'); // advanced, not frozen at 00:00
    expect(s.status).toBe('running');
  });
});

describe('reconcile after absence', () => {
  it('restores a still-running stage untouched', () => {
    const s = begin(30);
    expect(reconcile(s, T0 + 5_000)).toBe(s);
  });

  it('advances one elapsed stage on the anchored schedule', () => {
    const s = begin(30);
    const back = reconcile(s, T0 + 12_000); // settle over, 2s into gaze
    expect(back.stage).toBe('gaze');
    expect(deriveRemaining(back, T0 + 12_000)).toBe(28);
  });

  it('advances through multiple elapsed stages', () => {
    const e = ends(30);
    const s = begin(30);
    const back = reconcile(s, e.eyes + 5_000); // settle+gaze+eyes all over
    expect(back.stage).toBe('rest');
    expect(deriveRemaining(back, e.eyes + 5_000)).toBe(15);
  });

  it('lands on complete when the whole flow has passed', () => {
    const e = ends(30);
    const back = reconcile(begin(30), e.rest + 60_000);
    expect(back.stage).toBe('complete');
  });

  it('a paused record restores as paused', () => {
    let s = begin(30);
    s = reducer(s, { type: 'PAUSE', now: T0 + 4_000 });
    const back = reconcile(s, T0 + 999_999);
    expect(back.status).toBe('paused');
    expect(back.remainingMs).toBe(6_000);
  });
});

describe('end / practice again', () => {
  it('END returns to setup and keeps the chosen settings', () => {
    let s = begin(180, { target: 'physical', soundMode: 'silent' });
    s = reducer(s, { type: 'END' });
    expect(s.stage).toBe('setup');
    expect(s.target).toBe('physical');
    expect(s.gazeDurationS).toBe(180);
    expect(s.soundMode).toBe('silent');
  });

  it('PRACTICE_AGAIN from complete returns to setup with settings', () => {
    const e = ends(30);
    let s = reconcile(begin(30), e.rest + 1);
    expect(s.stage).toBe('complete');
    s = reducer(s, { type: 'PRACTICE_AGAIN' });
    expect(s.stage).toBe('setup');
    expect(s.gazeDurationS).toBe(30);
  });

  it('BEGIN is ignored outside setup (no double practice)', () => {
    const s = begin(30);
    expect(reducer(s, { type: 'BEGIN', now: T0 + 1 })).toBe(s);
  });
});
