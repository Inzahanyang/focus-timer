// Contour geometry — shared by the timer ring and (later) the dashboard
// terrain. Deterministic: same seed, same shape, stable screenshots/tests.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Closed, softly irregular contour path via Catmull-Rom smoothing. */
export function contourPath(seed, cx, cy, baseRadius, variance, count = 40) {
  const rand = mulberry32(Math.floor(seed) || 1);

  // Perturbed radii, then two smoothing passes so bumps read as terrain,
  // not noise.
  let radii = Array.from({ length: count }, () => {
    return baseRadius * (1 + (rand() * 2 - 1) * variance);
  });
  for (let pass = 0; pass < 2; pass++) {
    radii = radii.map((r, i) => {
      const prev = radii[(i - 1 + count) % count];
      const next = radii[(i + 1) % count];
      return (prev + r + next) / 3;
    });
  }

  const pts = radii.map((r, i) => {
    const angle = (i / count) * Math.PI * 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });

  // Catmull-Rom -> cubic Bezier, closed.
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < count; i++) {
    const p0 = pts[(i - 1 + count) % count];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % count];
    const p3 = pts[(i + 2) % count];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return `${d} Z`;
}
