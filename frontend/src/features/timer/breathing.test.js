import { beforeAll, describe, expect, it } from 'vitest';
import {
  BREATH_CYCLE_MS,
  breathState,
  isGuideEnabled,
  setGuideEnabled,
} from './breathing';

describe('breathState', () => {
  it('walks in -> hold -> out across one cycle', () => {
    expect(breathState(0).phase).toBe('in');
    expect(breathState(3_999).phase).toBe('in');
    expect(breathState(4_000).phase).toBe('hold');
    expect(breathState(5_999).phase).toBe('hold');
    expect(breathState(6_000).phase).toBe('out');
    expect(breathState(11_999).phase).toBe('out');
    expect(breathState(BREATH_CYCLE_MS).phase).toBe('in'); // wraps
  });

  it('scale is continuous at phase boundaries', () => {
    // end of inhale ~= hold
    expect(breathState(3_999).scale).toBeCloseTo(1.05, 2);
    expect(breathState(4_000).scale).toBe(1.05);
    // end of exhale ~= start of next inhale
    expect(breathState(11_999).scale).toBeCloseTo(1.0, 2);
    expect(breathState(12_000).scale).toBeCloseTo(1.0, 3);
  });

  it('scale stays within [1, 1.05]', () => {
    for (let t = 0; t < BREATH_CYCLE_MS * 2; t += 137) {
      const { scale } = breathState(t);
      expect(scale).toBeGreaterThanOrEqual(1);
      expect(scale).toBeLessThanOrEqual(1.05);
    }
  });

  it('handles junk input as cycle start', () => {
    expect(breathState(-5).phase).toBe('in');
    expect(breathState(NaN).phase).toBe('in');
    expect(breathState(undefined).scale).toBe(1);
  });

  it('a paused break freezes the phase (same elapsed -> same state)', () => {
    const a = breathState(7_300);
    const b = breathState(7_300);
    expect(a).toEqual(b);
  });
});

describe('break guide preference (opt-in, D33)', () => {
  beforeAll(() => {
    // node test env has no localStorage — a Map-backed stand-in suffices
    const store = new Map();
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    };
  });

  it('defaults to Quiet — the app never starts breathing for the user', () => {
    localStorage.removeItem('focus-atlas.break-guide.v1');
    expect(isGuideEnabled()).toBe(false);
  });

  it('round-trips the explicit opt-in', () => {
    setGuideEnabled(true);
    expect(isGuideEnabled()).toBe(true);
    setGuideEnabled(false);
    expect(isGuideEnabled()).toBe(false);
  });
});
