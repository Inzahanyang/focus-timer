import { describe, expect, it } from 'vitest';
import { BREATH_CYCLE_MS, breathState } from './breathing';

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

  it('amount is continuous at phase boundaries', () => {
    // end of inhale ~= hold
    expect(breathState(3_999).amount).toBeCloseTo(1, 2);
    expect(breathState(4_000).amount).toBe(1);
    // end of exhale ~= start of next inhale
    expect(breathState(11_999).amount).toBeCloseTo(0, 2);
    expect(breathState(12_000).amount).toBeCloseTo(0, 3);
  });

  it('amount stays within [0, 1]', () => {
    for (let t = 0; t < BREATH_CYCLE_MS * 2; t += 137) {
      const { amount } = breathState(t);
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThanOrEqual(1);
    }
  });

  it('inhale eases out: swells early, settles late', () => {
    // ease-out: first half of the inhale covers well over half the rise
    expect(breathState(2_000).amount).toBeGreaterThan(0.6);
    // exhale ease-in-out: gentle start to the descent
    expect(breathState(6_600).amount).toBeGreaterThan(0.9);
  });

  it('handles junk input as cycle start', () => {
    expect(breathState(-5).phase).toBe('in');
    expect(breathState(NaN).phase).toBe('in');
    expect(breathState(undefined).amount).toBe(0);
  });

  it('a paused break freezes the phase (same elapsed -> same state)', () => {
    const a = breathState(7_300);
    const b = breathState(7_300);
    expect(a).toEqual(b);
  });
});
