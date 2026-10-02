"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, RotateCcw, TriangleAlert, X } from "lucide-react";
import { TimerReadout } from "@/components/shell/timer-readout";
import { splitTime, useTimer, type TimerMode } from "@/lib/timer-store";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** "MM:SS", used in the switch caution where hours would only add noise. */
function formatClock(ms: number): string {
  const { m, s } = splitTime(ms);
  return `${m}:${s}`;
}

const PRESETS: { label: string; ms: number }[] = [
  { label: "5m", ms: 5 * 60_000 },
  { label: "10m", ms: 10 * 60_000 },
  { label: "25m", ms: 25 * 60_000 },
  { label: "45m", ms: 45 * 60_000 },
];

const MODES: { id: TimerMode; label: string }[] = [
  { id: "countdown", label: "Countdown" },
  { id: "stopwatch", label: "Stopwatch" },
];

/**
 * The timer's controls. Rendered inside a dropdown from the top bar on
 * desktop and as a bottom sheet from the floating pill on mobile — the same
 * body either way.
 *
 * The readout sits above the inputs so setting a duration and seeing it land
 * on the display is one continuous action rather than two disconnected ones.
 *
 * The panel owns its own dismissal: the X control stops the clock and puts
 * the timer away entirely, which is why no `onClose` prop is needed.
 */
export function TimerPanelBody() {
  const {
    mode, status, displayMs, totalMs,
    setMode, setDuration, start, pause, reset, close,
  } = useTimer();

  const [pendingMode, setPendingMode] = React.useState<TimerMode | null>(null);
  const running = status === "running";
  const finished = status === "finished";
  const canStart = mode === "stopwatch" || totalMs > 0;

  // Red only while a live countdown is inside its last minute — green once it
  // has actually elapsed, so the two states never read the same.
  const tone = finished
    ? "done"
    : mode === "countdown" && displayMs <= 60_000 && displayMs > 0
      ? "urgent"
      : "default";

  /**
   * There is one clock, so the other timer necessarily stops. Switching when
   * something is running is the one destructive action here, so it asks first
   * — and says plainly what is about to be lost. A switch with nothing
   * running is free and keeps both modes' settings intact.
   */
  const requestMode = (next: TimerMode) => {
    if (next === mode) return;
    haptics.selection();
    if (running) {
      setPendingMode(next);
      return;
    }
    setMode(next);
  };

  const confirmSwitch = () => {
    if (!pendingMode) return;
    haptics.tap();
    setMode(pendingMode);
    setPendingMode(null);
  };

  const handlePrimary = () => {
    if (running) {
      pause();
      return;
    }
    // Restarting a finished countdown needs the total restored first;
    // both setters use functional updates, so they compose in order.
    if (finished) reset();
    start();
  };

  const primaryLabel = running
    ? "Pause"
    : finished
      ? "Restart"
      : status === "paused"
        ? "Resume"
        : "Start";

  // ── Caution: switching away from a live timer ──────────────────────────
  if (pendingMode) {
    const from = mode === "countdown" ? "countdown" : "stopwatch";
    const to = pendingMode === "countdown" ? "countdown" : "stopwatch";

    return (
      <div className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field border border-warning-border/70 bg-warning-soft/70">
            <TriangleAlert className="h-4 w-4 text-warning" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight text-foreground">
              Stop your {from}?
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Only one timer can run at a time. Switching to {to} will stop this
              one at{" "}
              <span className="font-mono tabular-nums text-foreground">
                {formatClock(displayMs)}
              </span>
              .
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              haptics.tap();
              setPendingMode(null);
            }}
            className="glass-btn-base glass-btn-outline h-11 rounded-field px-4 text-sm"
          >
            Keep it running
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={confirmSwitch}
            className="glass-btn-base glass-btn-primary h-11 rounded-field px-4 text-sm"
          >
            Switch to {to}
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-6">
      {/* Mode switch */}
      <div
        role="tablist"
        aria-label="Timer mode"
        className="flex items-center gap-1 rounded-field border border-white/10 bg-black/40 p-1"
      >
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={mode === id}
            onClick={() => requestMode(id)}
            className={cn(
              "focus-ring relative flex h-9 flex-1 items-center justify-center rounded-[7px] px-3 text-sm font-medium transition-colors",
              mode === id ? "text-black" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {mode === id && (
              <motion.span
                layoutId="timer-mode-pill"
                className="absolute inset-0 rounded-[7px] bg-white"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {/*
        Readout is the hero and stands alone. The old eyebrow above it
        ("Running" / "Time's up" / "Set a duration") repeated what the ticking
        digits, the green-red readout and the primary button already say.
      */}
      <div className="mt-7 flex flex-col items-center">
        <TimerReadout ms={displayMs} size="lg" tone={tone} />
      </div>

      {/* Duration entry — a stopwatch has nothing to set before starting. */}
      {mode === "countdown" && (
        <AnimatePresence initial={false}>
          {!running && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-6">
                <HmsFields totalMs={totalMs} onChange={setDuration} />
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        haptics.selection();
                        setDuration(p.ms);
                      }}
                      className="focus-ring rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium tabular-nums text-foreground/80 transition-colors hover:border-white/25 hover:text-foreground"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Controls */}
      <div className="mt-7 flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={handlePrimary}
          disabled={!canStart}
          className="glass-btn-base glass-btn-primary h-12 flex-1 gap-2 rounded-field text-sm font-semibold disabled:opacity-40"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {primaryLabel}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={reset}
          aria-label="Reset timer"
          className="focus-ring glass-btn-base glass-btn-outline h-12 w-12 shrink-0 rounded-field"
        >
          <RotateCcw className="h-4 w-4" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={close}
          aria-label="Close timer"
          className="focus-ring glass-btn-base glass-btn-ghost h-12 w-12 shrink-0 rounded-field text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
        {mode === "countdown"
          ? "Keeps running while you use the rest of the app."
          : "Keeps counting while you use the rest of the app."}
      </p>
    </div>
  );
}

/** Three numeric fields that write straight back into a total in ms. */
function HmsFields({
  totalMs,
  onChange,
}: {
  totalMs: number;
  onChange: (ms: number) => void;
}) {
  const totalSeconds = Math.round(totalMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const setPart = (key: "h" | "m" | "s", raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const value = Math.min(Number(digits || 0), key === "h" ? 99 : 59);
    const next = { h, m, s, [key]: value };
    onChange((next.h * 3600 + next.m * 60 + next.s) * 1000);
  };

  const fields = [
    { key: "h" as const, label: "Hours", value: h },
    { key: "m" as const, label: "Minutes", value: m },
    { key: "s" as const, label: "Seconds", value: s },
  ];

  return (
    <div className="flex items-center justify-center gap-2">
      {fields.map((part, i) => (
        <React.Fragment key={part.key}>
          {i > 0 && (
            <span aria-hidden className="pb-6 text-2xl font-semibold text-foreground/25">
              :
            </span>
          )}
          <label className="flex flex-col items-center gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              aria-label={part.label}
              value={String(part.value).padStart(2, "0")}
              // Selecting on focus means typing replaces the field instead of
              // appending to it — otherwise "25" + "3" silently reads as 25.
              onFocus={(e) => e.target.select()}
              onChange={(e) => setPart(part.key, e.target.value)}
              className="glass-input focus-ring h-14 w-16 rounded-field text-center text-2xl font-semibold tabular-nums text-foreground [color-scheme:dark]"
            />
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {part.label}
            </span>
          </label>
        </React.Fragment>
      ))}
    </div>
  );
}