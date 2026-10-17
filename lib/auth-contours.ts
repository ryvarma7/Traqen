const TAU = Math.PI * 2;
const RINGS = 9;

// Angular terms never change. Cache them once, then apply sin(a+b) identities
// so animation frames need 6 shared trig calls, not 5 for every point.
const rings = Array.from({ length: RINGS }, (_, k) => {
  const points = [];
  for (let a = 0; a <= TAU + 0.06; a += 0.05) {
    points.push([
      Math.cos(a), Math.sin(a),
      Math.sin(a * 3 + k * 0.7), Math.cos(a * 3 + k * 0.7),
      Math.sin(a * 5 + k * 1.3), Math.cos(a * 5 + k * 1.3),
      Math.sin(a * 2 + k), Math.cos(a * 2 + k),
    ]);
  }
  return points;
});

type ContourContext = Pick<CanvasRenderingContext2D,
  "clearRect" | "beginPath" | "moveTo" | "lineTo" | "stroke" | "globalAlpha">;

export function paintAuthContours(ctx: ContourContext, w: number, h: number, time: number) {
  const s = time / 1000;
  const sin1 = Math.sin(s * 0.21), cos1 = Math.cos(s * 0.21);
  const sin2 = Math.sin(-s * 0.13), cos2 = Math.cos(-s * 0.13);
  const sin3 = Math.sin(-s * 0.3), cos3 = Math.cos(-s * 0.3);
  const step = Math.min(w, h) * 0.085;
  ctx.clearRect(0, 0, w, h);

  for (let k = 0; k < RINGS; k++) {
    const wave = Math.sin(s * 0.5 - k * 0.55);
    const glow = 0.5 + 0.5 * Math.sin(s * 0.5 - k * 0.55 + 0.4);
    const base = 110 + k * step + wave * 12;
    ctx.globalAlpha = (0.045 + 0.075 * glow) * (1 - k * 0.06);
    ctx.beginPath();
    const points = rings[k];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const r = base + (p[2] * cos1 + p[3] * sin1) * 9
        + (p[4] * cos2 + p[5] * sin2) * 6
        + (p[6] * cos3 + p[7] * sin3) * 4;
      const x = w * 0.5 + p[0] * r;
      const y = h * 0.5 + p[1] * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
