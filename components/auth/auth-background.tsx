"use client";

import * as React from "react";
import { paintAuthContours } from "@/lib/auth-contours";
import { createFrameScheduler } from "@/lib/frame-scheduler";

/* ─── Breathing contour field ─────────────────────────────────────────────
    Nine noise-displaced rings centered behind the login card. A swell of
    radius + brightness travels ring-by-ring from the inside out, so the
    field reads as something alive rather than a static texture.
    One canvas, one rAF loop, DPR capped at 2, paused on hidden tabs,
    static single frame under prefers-reduced-motion. */

export function AuthBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let width = 0;
    let height = 0;
    let time = 1200;
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("--color-fg").trim();
    ctx.lineWidth = 1;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Resizing clears the canvas state, including the stroke style.
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("--color-fg").trim();
      ctx.lineWidth = 1;
      paintAuthContours(ctx, width, height, preference.matches ? 1200 : time);
    };

    const draw = (t: number) => {
      time = t;
      paintAuthContours(ctx, width, height, t);
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (document.hidden) return;
      if (preference.matches) paintAuthContours(ctx, width, height, 1200);
      else raf = requestAnimationFrame(loop);
    };

    fit();
    onVisibility();
    const resize = createFrameScheduler(fit);
    window.addEventListener("resize", resize.schedule, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    preference.addEventListener("change", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      resize.cancel();
      window.removeEventListener("resize", resize.schedule);
      document.removeEventListener("visibilitychange", onVisibility);
      preference.removeEventListener("change", onVisibility);
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
