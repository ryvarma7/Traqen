"use client";

import * as React from "react";

/* ─── Breathing contour field ─────────────────────────────────────────────
    Nine noise-displaced rings centered behind the login card. A swell of
    radius + brightness travels ring-by-ring from the inside out, so the
    field reads as something alive rather than a static texture.
    One canvas, one rAF loop, DPR capped at 2, paused on hidden tabs,
    static single frame under prefers-reduced-motion. */

const RINGS = 9;
const TAU = Math.PI * 2;

export function AuthBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const s = t / 1000;
      // centered behind the card; rings radiate out from the login form
      const cx = w * 0.5;
      const cy = h * 0.5;
      const step = Math.min(w, h) * 0.085;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      for (let k = 0; k < RINGS; k++) {
        // each ring lags the one inside it — the breath travels outward
        const wave = Math.sin(s * 0.5 - k * 0.55);
        const glow = 0.5 + 0.5 * Math.sin(s * 0.5 - k * 0.55 + 0.4);
        const base = 110 + k * step + wave * 12;
        ctx.globalAlpha = (0.045 + 0.075 * glow) * (1 - k * 0.06);
        ctx.beginPath();
        for (let a = 0; a <= TAU + 0.06; a += 0.05) {
          const n =
            Math.sin(a * 3 + s * 0.21 + k * 0.7) * 9 +
            Math.sin(a * 5 - s * 0.13 + k * 1.3) * 6 +
            Math.sin(a * 2 - s * 0.3 + k) * 4;
          const r = base + n;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop);
    };

    fit();
    if (reduced) {
      draw(1200); // calm static frame for reduced motion
    } else {
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener("resize", fit);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}