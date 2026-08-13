// Steady Gaze audio — Web Audio only (brief §6, AUDIO-SOURCE-NOTES).
//
// The loops were synthesized so that every component frequency is an
// integer multiple of 1/T: AudioBufferSourceNode.loop = true repeats them
// with zero seam. Never convert to MP3 (padding breaks the seam).
//
// Loading discipline: nothing is fetched at app load. Bells load lazily
// when a practice starts with sound on; the two large ambient WAVs load
// ONLY when the user has chosen Ambient.

// All level constants in one place for listening adjustments (brief §6).
export const AUDIO_LEVELS = {
  // owner listening round 1: the brief's 0.045/0.030 were inaudible on
  // laptop speakers (the drone lives around 55 Hz, which small speakers
  // barely reproduce) — doubled, still under the bells
  gazeLoopGain: 0.09,
  eyesLoopGain: 0.06,
  bellStartGain: 0.1,
  bellTransitionGain: 0.1,
  bellCompleteGain: 0.1,
  // ambient chain EQ: tame the 55 Hz fundamental's room presence
  lowshelfHz: 90,
  lowshelfDb: -2,
  crossfadeS: 1.0, // 0.8–1.2s allowed
};

const ASSET_URLS = {
  gazeLoop: new URL(
    '../../assets/steady-gaze/01_steady_gaze_loop_90s.wav',
    import.meta.url
  ).href,
  eyesLoop: new URL(
    '../../assets/steady-gaze/02_eyes_closed_loop_60s.wav',
    import.meta.url
  ).href,
  bellStart: new URL(
    '../../assets/steady-gaze/03_bell_start.wav',
    import.meta.url
  ).href,
  bellTransition: new URL(
    '../../assets/steady-gaze/04_bell_transition.wav',
    import.meta.url
  ).href,
  bellComplete: new URL(
    '../../assets/steady-gaze/05_bell_complete.wav',
    import.meta.url
  ).href,
};

/** Which ambient loop belongs to which stage (D36): settle and rest stay
    quiet; the drone accompanies gaze, the darker loop accompanies the
    afterimage stage. */
export function loopForStage(stage) {
  if (stage === 'gaze') return 'gazeLoop';
  if (stage === 'eyes_closed') return 'eyesLoop';
  return null;
}

export function bellForTransition(fromStage, toStage) {
  if (toStage === 'gaze') return 'bellStart';
  if (toStage === 'eyes_closed') return 'bellTransition';
  if (toStage === 'complete') return 'bellComplete';
  return null;
}

const LOOP_GAINS = {
  gazeLoop: AUDIO_LEVELS.gazeLoopGain,
  eyesLoop: AUDIO_LEVELS.eyesLoopGain,
};
const BELL_GAINS = {
  bellStart: AUDIO_LEVELS.bellStartGain,
  bellTransition: AUDIO_LEVELS.bellTransitionGain,
  bellComplete: AUDIO_LEVELS.bellCompleteGain,
};

// ---------------------------------------------------------------------
// Engine (module singleton — one practice at a time by product rule)

let ctx = null;
const buffers = new Map(); // name -> AudioBuffer
const pendingFetches = new Map(); // name -> Promise
let activeLoop = null; // { name, source, gain }
let ambientStage = null; // latest stage requested — guards slow decodes

function getContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Call from a user gesture (Begin practice / Enable sound). Returns
    true when audio is usable. resume() can hang forever without real
    user activation, so it races a short timeout — the practice itself
    must never wait on audio. */
export async function unlockAudio() {
  const context = getContext();
  if (!context) return false;
  try {
    if (context.state === 'suspended') {
      await Promise.race([
        context.resume(),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    }
    return context.state === 'running';
  } catch {
    return false;
  }
}

export function isAudioRunning() {
  return ctx != null && ctx.state === 'running';
}

async function loadBuffer(name) {
  if (buffers.has(name)) return buffers.get(name);
  if (pendingFetches.has(name)) return pendingFetches.get(name);
  const promise = fetch(ASSET_URLS[name])
    .then((response) => response.arrayBuffer())
    .then((data) => getContext().decodeAudioData(data))
    .then((buffer) => {
      buffers.set(name, buffer);
      pendingFetches.delete(name);
      return buffer;
    })
    .catch((error) => {
      pendingFetches.delete(name);
      throw error;
    });
  pendingFetches.set(name, promise);
  return promise;
}

/** Prefetch the small bells (sound on). Ambient loops are NOT included. */
export function prefetchBells() {
  if (!getContext()) return;
  for (const name of Object.keys(BELL_GAINS)) {
    loadBuffer(name).catch(() => {});
  }
}

export async function playBell(name) {
  const context = getContext();
  if (!context || context.state !== 'running') return;
  try {
    const buffer = await loadBuffer(name);
    const gain = context.createGain();
    gain.gain.value = BELL_GAINS[name];
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
  } catch {
    // a missing bell is a silent practice, never an error dialog
  }
}

/** Start (or crossfade to) the ambient loop for a stage. Passing a stage
    with no loop fades the current one out. Gapless: loop=true on the
    buffer source, no fades baked into the files. */
export async function setAmbientStage(stage) {
  ambientStage = stage;
  const context = getContext();
  if (!context || context.state !== 'running') return;
  const name = loopForStage(stage);

  if (activeLoop && activeLoop.name === name) return;

  const fade = AUDIO_LEVELS.crossfadeS;
  const nowT = context.currentTime;

  if (activeLoop) {
    const old = activeLoop;
    activeLoop = null;
    old.gain.gain.setValueAtTime(old.gain.gain.value, nowT);
    old.gain.gain.linearRampToValueAtTime(0, nowT + fade);
    old.source.stop(nowT + fade + 0.05);
  }

  if (!name) return;
  try {
    const buffer = await loadBuffer(name);
    // the stage may have moved on while the large file was decoding —
    // a late arrival must not fade out the loop that took its place
    if (ambientStage !== stage) return;
    const gain = context.createGain();
    const eq = context.createBiquadFilter();
    eq.type = 'lowshelf';
    eq.frequency.value = AUDIO_LEVELS.lowshelfHz;
    eq.gain.value = AUDIO_LEVELS.lowshelfDb;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(eq);
    eq.connect(gain);
    gain.connect(context.destination);
    const t = context.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(LOOP_GAINS[name], t + fade);
    source.start();
    activeLoop = { name, source, gain };
  } catch {
    // ambient failure degrades to cues-only, silently
  }
}

/** Pause/resume freeze everything (loops keep their phase). */
export async function suspendAudio() {
  if (ctx && ctx.state === 'running') {
    try {
      await ctx.suspend();
    } catch {
      /* ignore */
    }
  }
}

export async function resumeAudio() {
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

/** End of practice: stop the loop; keep the context for the next one. */
export function stopAmbient() {
  ambientStage = null; // cancels any loop still decoding
  if (!activeLoop || !ctx) return;
  try {
    const t = ctx.currentTime;
    activeLoop.gain.gain.setValueAtTime(activeLoop.gain.gain.value, t);
    activeLoop.gain.gain.linearRampToValueAtTime(0, t + 0.3);
    activeLoop.source.stop(t + 0.4);
  } catch {
    /* ignore */
  }
  activeLoop = null;
}
