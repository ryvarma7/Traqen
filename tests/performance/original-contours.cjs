// Reference math from 90a8fda: a fixed oracle, not production code.
function originalPaint(ctx, w, h, t) {
  const s = t / 1000, step = Math.min(w, h) * 0.085;
  ctx.clearRect(0, 0, w, h);
  for (let k = 0; k < 9; k++) {
    const wave = Math.sin(s * 0.5 - k * 0.55);
    const glow = 0.5 + 0.5 * Math.sin(s * 0.5 - k * 0.55 + 0.4);
    const base = 110 + k * step + wave * 12;
    ctx.globalAlpha = (0.045 + 0.075 * glow) * (1 - k * 0.06);
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.06; a += 0.05) {
      const n = Math.sin(a * 3 + s * 0.21 + k * 0.7) * 9
        + Math.sin(a * 5 - s * 0.13 + k * 1.3) * 6
        + Math.sin(a * 2 - s * 0.3 + k) * 4;
      const r = base + n, x = w * 0.5 + Math.cos(a) * r, y = h * 0.5 + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
module.exports = { originalPaint };
