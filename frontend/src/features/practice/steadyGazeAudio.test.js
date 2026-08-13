// The audio engine needs a real AudioContext; what CAN be pinned down in
// node is the pure mapping layer — which loop belongs to which stage,
// which bell marks which transition, and that the tuning constants stay
// inside the brief's bounds.

import { describe, expect, it } from 'vitest';
import {
  AUDIO_LEVELS,
  bellForTransition,
  loopForStage,
} from './steadyGazeAudio';

describe('stage -> ambient loop mapping (D36)', () => {
  it('gaze and eyes_closed carry their own loops; settle/rest stay quiet', () => {
    expect(loopForStage('settle')).toBeNull();
    expect(loopForStage('gaze')).toBe('gazeLoop');
    expect(loopForStage('eyes_closed')).toBe('eyesLoop');
    expect(loopForStage('rest')).toBeNull();
    expect(loopForStage('complete')).toBeNull();
  });
});

describe('transition -> bell mapping', () => {
  it('start bell on gaze, transition bell on eyes closed, complete bell at the end', () => {
    expect(bellForTransition('settle', 'gaze')).toBe('bellStart');
    expect(bellForTransition('gaze', 'eyes_closed')).toBe('bellTransition');
    expect(bellForTransition('rest', 'complete')).toBe('bellComplete');
    // no bell entering settle or rest
    expect(bellForTransition('setup', 'settle')).toBeNull();
    expect(bellForTransition('eyes_closed', 'rest')).toBeNull();
  });
});

describe('tuning constants stay within the brief', () => {
  it('ambient sits far below the bells and eyes stays under gaze', () => {
    expect(AUDIO_LEVELS.eyesLoopGain).toBeLessThan(AUDIO_LEVELS.gazeLoopGain);
    expect(AUDIO_LEVELS.gazeLoopGain).toBeLessThan(AUDIO_LEVELS.bellStartGain);
  });

  it('crossfade stays in the allowed 0.8–1.2s window', () => {
    expect(AUDIO_LEVELS.crossfadeS).toBeGreaterThanOrEqual(0.8);
    expect(AUDIO_LEVELS.crossfadeS).toBeLessThanOrEqual(1.2);
  });
});
