import { useEffect, useReducer, useRef, useState } from 'react';
import { formatClock } from '../../lib/formatters';
import {
  bellForTransition,
  isAudioRunning,
  playBell,
  prefetchBells,
  resumeAudio,
  setAmbientStage,
  stopAmbient,
  suspendAudio,
  unlockAudio,
} from './steadyGazeAudio';
import {
  deriveRemaining,
  GAZE_DURATIONS_S,
  initialState,
  reconcile,
  reducer,
} from './steadyGazeMachine';
import {
  clearPracticeRecord,
  loadPracticeRecord,
  loadSettings,
  persistPracticeRecord,
  saveSettings,
} from './steadyGazeStorage';
import VirtualFlame from './VirtualFlame';

// Steady Gaze — a guided Trataka practice. Not a subject, not a focus
// session, never saved to the server (brief §1). The practice is about
// steady attention, not endurance.

const DURATION_LABELS = { 30: '30 sec', 60: '1 min', 180: '3 min', 300: '5 min' };
const SOUND_LABELS = { cues: 'Cues only', ambient: 'Ambient', silent: 'Silent' };

const STAGE_HEADINGS = {
  settle: 'SETTLE',
  gaze: 'STEADY GAZE',
  eyes_closed: 'CLOSE YOUR EYES',
  rest: 'REST YOUR EYES',
};

const STAGE_ANNOUNCEMENTS = {
  settle: 'Settle. Sit comfortably.',
  gaze: 'Steady gaze. Keep a soft gaze and blink whenever you need to.',
  eyes_closed: 'Close your eyes and notice the image that remains.',
  rest: 'Rest your eyes.',
  complete: 'Practice complete.',
};

function initPractice() {
  const settings = loadSettings();
  const restored = reconcile(loadPracticeRecord(), Date.now());
  if (restored && restored.stage !== 'setup') return restored;
  return {
    ...initialState,
    target: settings.target ?? initialState.target,
    gazeDurationS: settings.gazeDurationS ?? initialState.gazeDurationS,
    soundMode: settings.soundMode ?? initialState.soundMode,
  };
}

export default function SteadyGaze({ onClose }) {
  const [state, dispatch] = useReducer(reducer, undefined, initPractice);
  const [now, setNow] = useState(() => Date.now());
  const [showIntro, setShowIntro] = useState(() => !loadSettings().seenIntro);
  const [soundBlocked, setSoundBlocked] = useState(
    // restored mid-practice with sound on: autoplay policy needs a gesture
    () => state.stage !== 'setup' && state.soundMode !== 'silent'
  );
  const [controlsIdle, setControlsIdle] = useState(false);

  const { stage, status } = state;
  const timed = ['settle', 'gaze', 'eyes_closed', 'rest'].includes(stage);
  const running = timed && status === 'running';
  const remaining = deriveRemaining(state, now);

  /* ---------- clock plumbing (same discipline as the focus timer) ---- */
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const wake = () => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, []);

  useEffect(() => {
    if (running && remaining === 0) {
      dispatch({ type: 'STAGE_ELAPSED', now: Date.now() });
    }
  }, [running, remaining]);

  useEffect(() => {
    persistPracticeRecord(timed ? state : null);
  }, [state, timed]);

  /* ---------- audio: bells once per live transition, ambient per stage */
  const prevStageRef = useRef(stage);
  useEffect(() => {
    const prev = prevStageRef.current;
    prevStageRef.current = stage;
    if (prev === stage) return;
    if (state.soundMode !== 'silent' && isAudioRunning()) {
      const bell = bellForTransition(prev, stage);
      if (bell) playBell(bell);
    }
    if (state.soundMode === 'ambient') {
      setAmbientStage(stage); // lazy-loads only the loop it needs
    }
    if (stage === 'complete') stopAmbient();
  }, [stage, state.soundMode]);

  /* ---------- gaze immersion: controls fade after 3s, any input recalls */
  useEffect(() => {
    if (stage !== 'gaze' || status !== 'running') {
      setControlsIdle(false);
      return undefined;
    }
    let timer = setTimeout(() => setControlsIdle(true), 3000);
    const recall = () => {
      setControlsIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setControlsIdle(true), 3000);
    };
    window.addEventListener('pointermove', recall);
    window.addEventListener('pointerdown', recall);
    window.addEventListener('keydown', recall);
    window.addEventListener('touchstart', recall);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', recall);
      window.removeEventListener('pointerdown', recall);
      window.removeEventListener('keydown', recall);
      window.removeEventListener('touchstart', recall);
    };
  }, [stage, status]);

  /* ---------- actions ---------- */
  const configure = (patch) => dispatch({ type: 'CONFIGURE', ...patch });

  const begin = () => {
    const startNow = Date.now();
    setNow(startNow);
    saveSettings({
      seenIntro: true,
      target: state.target,
      gazeDurationS: state.gazeDurationS,
      soundMode: state.soundMode,
    });
    // The practice starts NOW — audio unlocks in parallel and may fail
    // quietly (autoplay policy); it never gates the timer.
    dispatch({ type: 'BEGIN', now: startNow });
    if (state.soundMode !== 'silent') {
      unlockAudio().then((unlocked) => {
        setSoundBlocked(!unlocked);
        if (unlocked) {
          prefetchBells();
          if (state.soundMode === 'ambient') setAmbientStage('settle');
        }
      });
    } else {
      setSoundBlocked(false);
    }
  };

  const enableSound = async () => {
    const unlocked = await unlockAudio();
    setSoundBlocked(!unlocked);
    if (unlocked) {
      prefetchBells();
      if (state.soundMode === 'ambient') setAmbientStage(stage);
    }
  };

  const pause = () => {
    dispatch({ type: 'PAUSE', now: Date.now() });
    suspendAudio();
  };

  const resume = () => {
    const resumeNow = Date.now();
    setNow(resumeNow);
    dispatch({ type: 'RESUME', now: resumeNow });
    resumeAudio();
  };

  const end = () => {
    stopAmbient();
    clearPracticeRecord();
    onClose();
  };

  const practiceAgain = () => {
    clearPracticeRecord();
    dispatch({ type: 'PRACTICE_AGAIN' });
  };

  /* ---------- intro (first visit / About this practice) ---------- */
  if (showIntro) {
    return (
      <div className="timer-page gaze-setup">
        <span className="micro-label">Steady Gaze</span>
        <h1 className="timer-question">A guided Trataka practice</h1>
        <p className="gaze-copy">
          Trataka is a traditional yogic concentration practice. Rest your
          gaze on one small, steady target, then close your eyes and notice
          the image that remains.
        </p>
        <p className="gaze-copy gaze-principle">
          The practice is about steady attention, not endurance.
        </p>

        <div className="gaze-safety">
          <span className="micro-label">Practice gently</span>
          <p>
            Keep a soft gaze. Blink whenever you need to. Stop if you feel
            pain, strong irritation, dizziness, headache, or blurred vision
            that does not clear quickly. Never use the sun as a target.
          </p>
          <p>This is a concentration practice, not an eye treatment.</p>
        </div>

        <div className="timer-controls">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const settings = loadSettings();
              saveSettings({ ...settings, seenIntro: true });
              setShowIntro(false);
            }}
          >
            Continue
          </button>
        </div>
        <button type="button" className="btn btn-quiet demo-entry" onClick={end}>
          Back to focus
        </button>
      </div>
    );
  }

  /* ---------- setup ---------- */
  if (stage === 'setup') {
    return (
      <div className="timer-page gaze-setup">
        <span className="micro-label">Steady Gaze</span>
        <h1 className="timer-question">Choose a target</h1>

        <div className="gaze-targets" role="group" aria-label="Choose a target">
          <button
            type="button"
            className="gaze-target"
            aria-pressed={state.target === 'virtual'}
            onClick={() => configure({ target: 'virtual' })}
          >
            <strong>Virtual flame</strong>
            <span>A calm on-screen flame.</span>
          </button>
          <button
            type="button"
            className="gaze-target"
            aria-pressed={state.target === 'physical'}
            onClick={() => configure({ target: 'physical' })}
          >
            <strong>Physical target</strong>
            <span>Use a candle or a steady point in front of you.</span>
          </button>
        </div>

        {state.target === 'virtual' && (
          <p className="field-note">Set your screen to a comfortable brightness.</p>
        )}
        {state.target === 'physical' && (
          <p className="gaze-safety-inline">
            Place a candle on a stable, heat-resistant surface, away from
            curtains and anything flammable. Never leave a flame unattended.
            A small fixed point may be used instead.
          </p>
        )}

        <div className="gaze-field">
          <span className="micro-label">Gaze duration</span>
          <div className="subject-row" role="group" aria-label="Gaze duration">
            {GAZE_DURATIONS_S.map((seconds) => (
              <button
                key={seconds}
                type="button"
                className="chip"
                aria-pressed={state.gazeDurationS === seconds}
                onClick={() => configure({ gazeDurationS: seconds })}
              >
                {DURATION_LABELS[seconds]}
              </button>
            ))}
          </div>
          <p className="field-note">Choose a duration that feels comfortable.</p>
        </div>

        <div className="gaze-field">
          <span className="micro-label">Sound</span>
          <div className="subject-row" role="group" aria-label="Sound">
            {Object.entries(SOUND_LABELS).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className="chip"
                aria-pressed={state.soundMode === mode}
                onClick={() => configure({ soundMode: mode })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="timer-controls">
          <button type="button" className="btn btn-primary btn-lg" onClick={begin}>
            Begin practice
          </button>
        </div>
        <button
          type="button"
          className="btn btn-quiet demo-entry"
          onClick={() => setShowIntro(true)}
        >
          About this practice
        </button>
        <button type="button" className="btn btn-quiet demo-entry" onClick={end}>
          Back to focus
        </button>
      </div>
    );
  }

  /* ---------- complete ---------- */
  if (stage === 'complete') {
    return (
      <div className="timer-page">
        <p className="timer-question" role="status">
          Practice complete.
        </p>
        <div className="timer-controls">
          <button type="button" className="btn btn-primary" onClick={end}>
            Return to focus
          </button>
          <button type="button" className="btn" onClick={practiceAgain}>
            Practice again
          </button>
        </div>
      </div>
    );
  }

  /* ---------- timed stages ---------- */
  const dark =
    stage === 'eyes_closed' ||
    stage === 'rest' ||
    (stage === 'gaze' && state.target === 'physical') ||
    (stage === 'gaze' && state.target === 'virtual');
  const showFlame = stage === 'gaze' && state.target === 'virtual';
  const fadeUi = stage === 'gaze' && status === 'running' && controlsIdle;

  return (
    <div className={`gaze-stage-screen${dark ? ' is-dark' : ''}`}>
      {showFlame && <VirtualFlame />}

      <div className={`gaze-ui${fadeUi ? ' is-idle' : ''}`}>
        <span className="micro-label gaze-heading">
          {STAGE_HEADINGS[stage]}
        </span>

        {stage === 'settle' && (
          <p className="gaze-copy">
            Sit comfortably.
            <br />
            Let your breathing become quiet.
          </p>
        )}
        {stage === 'gaze' && state.target === 'virtual' && (
          <p className="gaze-copy">
            Keep a soft gaze.
            <br />
            Blink whenever you need to.
          </p>
        )}
        {stage === 'gaze' && state.target === 'physical' && (
          <p className="gaze-copy">Rest your gaze on your chosen point.</p>
        )}
        {stage === 'eyes_closed' && (
          <p className="gaze-copy">
            Notice the image that remains.
            <br />
            Do not try to hold it still.
          </p>
        )}
        {stage === 'rest' && (
          <p className="gaze-copy">
            Let your eyes rest naturally.
            <br />
            <span className="gaze-subnote">
              You may cup warm palms lightly over closed eyes. Do not press.
            </span>
          </p>
        )}

        {/* During gaze the countdown recedes with the rest of the UI —
            the flame is the object of attention, not the number. */}
        <span className="stage-clock gaze-clock" role="timer">
          {formatClock(remaining)}
        </span>
        {status === 'paused' && <p className="gaze-copy">Paused</p>}

        <div className="timer-controls">
          {status === 'running' && (
            <button type="button" className="btn" onClick={pause}>
              Pause
            </button>
          )}
          {status === 'paused' && (
            <button type="button" className="btn btn-primary" onClick={resume}>
              Resume
            </button>
          )}
          <button type="button" className="btn btn-quiet" onClick={end}>
            End
          </button>
        </div>

        {soundBlocked && state.soundMode !== 'silent' && (
          <button
            type="button"
            className="btn btn-quiet demo-entry"
            onClick={enableSound}
          >
            Enable sound
          </button>
        )}
      </div>

      {/* one announcement per stage, never per second */}
      <div className="sr-only" aria-live="polite">
        {STAGE_ANNOUNCEMENTS[stage]}
      </div>
    </div>
  );
}
