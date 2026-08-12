import { useMemo } from 'react';
import { contourPath } from './contourGeometry';

// A contour line, not a progress ring. The closed curve is irregular —
// seeded by subject so each subject's terrain has its own shape, but
// deterministic so it never jitters between renders (DESIGN_SYSTEM §5).
export default function ContourRing({
  progress, // 0..1, derived from wall-clock time upstream
  seed = 1,
  size = 340,
  paused = false,
  label, // accessible meaning differs between focus and break
  valueNow,
  children,
}) {
  const half = size / 2;
  const outer = useMemo(
    () => contourPath(seed * 13 + 5, half, half, size * 0.42, 0.05),
    [seed, half, size]
  );
  const inner = useMemo(
    () => contourPath(seed * 29 + 11, half, half, size * 0.31, 0.07),
    [seed, half, size]
  );

  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div className="stage" style={{ width: size, height: size }}>
      <svg
        className={`contour${paused ? ' is-paused' : ''}`}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
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
          <path className="contour-track" d={outer} pathLength="1" />
          <path
            className="contour-progress"
            d={outer}
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - clamped}
          />
        </g>
      </svg>
      <div className="stage-center">{children}</div>
    </div>
  );
}
