import { useMemo } from 'react';
import { contourPath } from './contourGeometry';

// A contour line, not a progress ring (design pass 2, directive #2):
// three irregular closed curves with visible relief. The bright progress
// stroke draws along the SAME outer contour path — the contour itself is
// the timer. Seeded per subject+session, deterministic between renders.
const VIEW = 400;

export default function ContourRing({
  progress, // 0..1, derived from wall-clock time upstream
  seed = 1,
  paused = false,
  label, // accessible meaning differs between focus and break
  valueNow,
  color, // subject color (CSS value); muted-mixed into the stroke
  children,
}) {
  const half = VIEW / 2;
  const outer = useMemo(
    () => contourPath(seed * 13 + 5, half, half, VIEW * 0.42, 0.075),
    [seed, half]
  );
  const mid = useMemo(
    () => contourPath(seed * 29 + 11, half, half, VIEW * 0.335, 0.09),
    [seed, half]
  );
  const inner = useMemo(
    () => contourPath(seed * 47 + 23, half, half, VIEW * 0.26, 0.11),
    [seed, half]
  );

  const clamped = Math.min(1, Math.max(0, progress));

  const progressStyle = {
    strokeDasharray: 1,
    strokeDashoffset: 1 - clamped,
  };
  if (color) {
    // Low-saturation subject identity: the same data keeps the same color
    // from the picker dot to History strata to the Dashboard ridge.
    // Falls back to the stylesheet stroke where color-mix is unsupported.
    progressStyle.stroke = `color-mix(in oklab, ${color} 52%, var(--contour))`;
  }

  return (
    <div className="stage">
      <svg
        className={`contour${paused ? ' is-paused' : ''}`}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valueNow != null ? valueNow : Math.round(clamped * 100)}
        aria-label={
          label || `Focus progress, ${Math.round(clamped * 100)} percent complete`
        }
      >
        {/* Start the line at 12 o'clock. */}
        <g transform={`rotate(-90 ${half} ${half})`}>
          <path className="contour-inner" d={inner} />
          <path className="contour-inner contour-mid" d={mid} />
          <path className="contour-track" d={outer} pathLength="1" />
          <path
            className="contour-progress"
            d={outer}
            pathLength="1"
            style={progressStyle}
          />
        </g>
      </svg>
      <div className="stage-center">{children}</div>
    </div>
  );
}
