import { useMemo } from 'react';
import { subjectColorVar } from '../../lib/formatters';
import {
  BUCKETS_PER_DAY,
  bucketize,
  dayTotals,
  smoothWeek,
  weekBoundsLocal,
} from './terrainMath';

// The week's focus as terrain: seven ridges (Mon–Sun), each a smoothed
// density curve of focused minutes across the 24 local hours. Built from
// real sessions only — quiet weeks are low, quiet terrain, which is the
// honest empty state (DESIGN_SYSTEM §6, design pass 2 directive #1).

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const VIEW_W = 720;
const ROW_H = 34; // baseline spacing; ridges may rise into the row above
const RIDGE_H = 44; // max ridge height above its baseline
const PAD_X = 46;
const PAD_TOP = RIDGE_H + 8;

function ridgePath(values, baselineY, maxValue, innerWidth) {
  // Bucket centers: hour h sits at (h + 0.5)/24 — aligned with the hour
  // labels which sit at exact h/24 positions.
  const points = values.map((value, index) => {
    const x = PAD_X + ((index + 0.5) / BUCKETS_PER_DAY) * innerWidth;
    const y = baselineY - (maxValue > 0 ? (value / maxValue) * RIDGE_H : 0);
    return [x, y];
  });
  let d = `M ${PAD_X} ${baselineY.toFixed(1)}`;
  d += ` L ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const cx = (px + x) / 2;
    d += ` C ${cx.toFixed(1)} ${py.toFixed(1)}, ${cx.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  d += ` L ${(PAD_X + innerWidth).toFixed(1)} ${baselineY.toFixed(1)}`;
  return d;
}

export default function FocusTerrain({ weekSessions }) {
  const innerWidth = VIEW_W - PAD_X * 2;
  const height = PAD_TOP + ROW_H * 7 + 20;

  const { paths, colors, totals } = useMemo(() => {
    const { start, end } = weekBoundsLocal();
    const { flat, dominant } = bucketize(weekSessions, start, end);
    const smoothed = smoothWeek(flat);
    const maxValue = Math.max(1, ...smoothed);
    return {
      paths: Array.from({ length: 7 }, (_, day) =>
        ridgePath(
          smoothed.slice(day * BUCKETS_PER_DAY, (day + 1) * BUCKETS_PER_DAY),
          PAD_TOP + ROW_H * (day + 1),
          maxValue,
          innerWidth
        )
      ),
      colors: dominant.map((tally) => {
        let best = null;
        let bestMinutes = 0;
        for (const [subjectId, minutes] of tally) {
          if (minutes > bestMinutes) {
            best = subjectId;
            bestMinutes = minutes;
          }
        }
        return best != null ? subjectColorVar(best) : null;
      }),
      totals: dayTotals(flat),
    };
  }, [weekSessions, innerWidth]);

  // The summary describes the terrain's own buckets — not the server's
  // completion-day attribution — so screen readers hear what is drawn.
  const summary = DAYS.map(
    (day, index) => `${day} ${totals[index]} minutes`
  ).join(', ');

  return (
    <figure
      className="terrain"
      aria-label={`This week's focus by day and hour: ${summary}`}
    >
      <svg
        className="terrain-svg"
        viewBox={`0 0 ${VIEW_W} ${height}`}
        role="img"
        aria-hidden="true"
      >
        {DAYS.map((day, index) => {
          const baseline = PAD_TOP + ROW_H * (index + 1);
          return (
            <g key={day}>
              <text className="terrain-day" x={8} y={baseline + 4}>
                {day}
              </text>
              <line
                className="terrain-baseline"
                x1={PAD_X}
                x2={PAD_X + innerWidth}
                y1={baseline}
                y2={baseline}
              />
              <path
                className="terrain-ridge"
                d={paths[index]}
                style={colors[index] ? { fill: colors[index] } : undefined}
              />
            </g>
          );
        })}
        {[0, 6, 12, 18, 24].map((hour) => (
          <text
            key={hour}
            className="terrain-hour"
            x={PAD_X + (innerWidth * hour) / 24}
            y={height - 4}
            textAnchor="middle"
          >
            {String(hour).padStart(2, '0')}
          </text>
        ))}
      </svg>
    </figure>
  );
}
