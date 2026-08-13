// Guided practices: quiet, co-equal secondary actions on the ready
// screen (brief §2) — never louder than Begin focus, no cards, no icons.
export default function PracticeActions({ onBreathing, onSteadyGaze }) {
  return (
    <div className="practices">
      <span className="micro-label">Guided practices</span>
      <div className="practices-row">
        <button type="button" className="btn btn-quiet" onClick={onBreathing}>
          Breathing pause
        </button>
        <button type="button" className="btn btn-quiet" onClick={onSteadyGaze}>
          Steady gaze
        </button>
      </div>
    </div>
  );
}
