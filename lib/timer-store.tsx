"use client";

import * as React from "react";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";

/**
 * Universal session timer. Mounted once at the app root so the countdown or
 * stopwatch keeps running while the user moves between pages — the header
 * control and the floating pill are just two views onto this one store.
 *
 * Elapsed time is never accumulated tick-by-tick. A running countdown stores
 * an absolute `endsAt` deadline and a running stopwatch an absolute
 * `runStartedAt`, both read against the wall clock. `setInterval` drifts and
 * throttles hard in background tabs; a deadline does not, so the time stays
 * correct after the tab has been asleep for minutes.
 *
 * Each mode keeps its OWN state slice. Only one can be running at a time —
 * there is a single clock — but switching tabs must not destroy what the
 * other one was set up with. Previously the two shared one flat object, so
 * visiting the stopwatch silently wiped a configured countdown mid-run.
 * Switching away from a *running* timer is gated by the caller, which asks
 * for confirmation first, because it necessarily stops that timer.
 *
 * State is persisted to localStorage so a reload or a crash mid-session
 * doesn't silently lose a running timer. It is device-local on purpose — no
 * schema change and nothing to sync.
 */

export type TimerMode = "countdown" | "stopwatch";
export type TimerStatus = "idle" | "running" | "paused" | "finished";

const STORAGE_KEY = "traqen.timer.v1";
const TICK_MS = 200;

interface CountdownState {
  /** The configured length of the run. */
  totalMs: number;
  /** Remaining time when not running. */
  remainingMs: number;
  /** Absolute deadline while running. */
  endsAt: number | null;
}

interface StopwatchState {
  /** Time banked from previous run segments. */
  elapsedMs: number;
  /** Absolute start of the live segment while running. */
  runStartedAt: number | null;
}

interface Persisted {
  mode: TimerMode;
  status: TimerStatus;
  countdown: CountdownState;
  stopwatch: StopwatchState;
}

/** What actually sits in localStorage. v1 stored both modes flattened into
 *  one object; v2 nests them, so the legacy keys stay readable here. */
type StoredPayload = Partial<Persisted> & {
  totalMs?: number;
  remainingMs?: number;
  endsAt?: number | null;
  elapsedMs?: number;
  runStartedAt?: number | null;
};

interface TimerContextValue extends Persisted {
  /** The time to show right now, in ms. Countdowns clamp at zero. */
  displayMs: number;
  /** Configured countdown length — 0 for the stopwatch. */
  totalMs: number;
  /** False until localStorage has been read, so SSR and first paint agree. */
  hydrated: boolean;
  panelOpen: boolean;
  active: boolean;
  openPanel: () => void;
  closePanel: () => void;
  setMode: (mode: TimerMode) => void;
  setDuration: (ms: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  close: () => void;
}

const TimerContext = React.createContext<TimerContextValue | null>(null);

const INITIAL: Persisted = {
  mode: "countdown",
  status: "idle",
  countdown: { totalMs: 25 * 60_000, remainingMs: 25 * 60_000, endsAt: null },
  stopwatch: { elapsedMs: 0, runStartedAt: null },
};

function clampMs(ms: number) {
  // 99h 59m 59s — keeps the readout to at most three digits per unit.
  return Math.min(Math.max(0, Math.round(ms)), 359_999_000);
}

/** Freezes a running clock at `t`, banking whatever it had accumulated. */
function banked(s: Persisted, t: number): Persisted {
  if (s.status !== "running") {
    return {
      ...s,
      status: s.status === "finished" ? "finished" : "idle",
      countdown: { ...s.countdown, endsAt: null },
      stopwatch: { ...s.stopwatch, runStartedAt: null },
    };
  }
  return s.mode === "countdown"
    ? {
        ...s,
        status: "idle",
        countdown: {
          ...s.countdown,
          remainingMs: Math.max(0, (s.countdown.endsAt ?? t) - t),
          endsAt: null,
        },
        stopwatch: { ...s.stopwatch, runStartedAt: null },
      }
    : {
        ...s,
        status: "idle",
        countdown: { ...s.countdown, endsAt: null },
        stopwatch: {
          elapsedMs: s.stopwatch.elapsedMs + (t - (s.stopwatch.runStartedAt ?? t)),
          runStartedAt: null,
        },
      };
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Persisted>(INITIAL);
  const [now, setNow] = React.useState(() => Date.now());
  const [hydrated, setHydrated] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);

  // Guards the end-of-countdown toast so it fires once per run, not per tick.
  const announced = React.useRef(false);

  // ── Hydrate ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredPayload;
        const merged: Persisted = {
          ...INITIAL,
          ...parsed,
          // Older payloads were flat; fold them into the new shape so an
          // already-running timer survives the upgrade.
          countdown: {
            ...INITIAL.countdown,
            ...(parsed.countdown ?? {}),
            ...(parsed.totalMs !== undefined ? { totalMs: parsed.totalMs } : {}),
            ...(parsed.remainingMs !== undefined ? { remainingMs: parsed.remainingMs } : {}),
            ...(parsed.endsAt !== undefined ? { endsAt: parsed.endsAt } : {}),
          },
          stopwatch: {
            ...INITIAL.stopwatch,
            ...(parsed.stopwatch ?? {}),
            ...(parsed.elapsedMs !== undefined ? { elapsedMs: parsed.elapsedMs } : {}),
            ...(parsed.runStartedAt !== undefined ? { runStartedAt: parsed.runStartedAt } : {}),
          },
        };

        if (merged.mode !== "countdown" && merged.mode !== "stopwatch") merged.mode = INITIAL.mode;

        // Never trust a persisted status on its own: a countdown whose
        // deadline passed while the tab was closed is finished, not running.
        if (merged.status === "running" && merged.mode === "countdown") {
          if ((merged.countdown.endsAt ?? 0) > Date.now()) {
            merged.status = "running";
          } else {
            merged.status = "finished";
            merged.countdown = { ...merged.countdown, remainingMs: 0, endsAt: null };
          }
        }
        if (merged.status === "running" && merged.mode === "stopwatch") {
          merged.status = (merged.stopwatch.runStartedAt ?? 0) <= Date.now() ? "running" : "idle";
        }

        setState(merged);
      }
    } catch {
      // Corrupt entry — fall back to the defaults rather than crashing.
    }
    setHydrated(true);
  }, []);

  // ── Persist ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode / quota — the timer still works, it just won't survive
      // a reload.
    }
  }, [state, hydrated]);

  // ── Tick ───────────────────────────────────────────────────────────────
  const running = state.status === "running";
  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  // Re-sync the clock the moment the tab comes back to the foreground.
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const displayMs =
    state.mode === "countdown"
      ? state.status === "running"
        ? Math.max(0, (state.countdown.endsAt ?? now) - now)
        : state.countdown.remainingMs
      : state.stopwatch.elapsedMs +
        (state.status === "running" ? now - (state.stopwatch.runStartedAt ?? now) : 0);

  // ── End of countdown ───────────────────────────────────────────────────
  React.useEffect(() => {
    if (state.mode !== "countdown" || !running) return;
    if (displayMs > 0) {
      announced.current = false;
      return;
    }
    if (announced.current) return;
    announced.current = true;

    setState((s) => ({
      ...s,
      status: "finished",
      countdown: { ...s.countdown, remainingMs: 0, endsAt: null },
    }));
    haptics.success();
    toast.success("Time's up");
  }, [displayMs, running, state.mode]);

  // ── Actions ────────────────────────────────────────────────────────────
  const setMode = React.useCallback((mode: TimerMode) => {
    setNow(Date.now());
    setState((s) => {
      if (s.mode === mode) return s;
      // Bank and stop the current clock, then switch. Both modes keep their
      // own configured values, so tabbing across and back is lossless.
      const frozen = banked(s, Date.now());
      return { ...frozen, mode };
    });
  }, []);

  const setDuration = React.useCallback((ms: number) => {
    const next = clampMs(ms);
    setState((s) =>
      s.mode !== "countdown" || s.status === "running"
        ? s
        : {
            ...s,
            status: next === 0 ? "finished" : "idle",
            countdown: { ...s.countdown, totalMs: next, remainingMs: next },
          }
    );
  }, []);

  const start = React.useCallback(() => {
    setNow(Date.now());
    setState((s) => {
      if (s.status === "running") return s;
      if (s.mode === "countdown") {
        const remaining = s.status === "finished" ? 0 : s.countdown.remainingMs;
        if (remaining <= 0) return s;
        return {
          ...s,
          status: "running",
          countdown: { ...s.countdown, remainingMs: remaining, endsAt: Date.now() + remaining },
        };
      }
      return { ...s, status: "running", stopwatch: { ...s.stopwatch, runStartedAt: Date.now() } };
    });
    haptics.impact();
  }, []);

  const pause = React.useCallback(() => {
    setNow(Date.now());
    setState((s) => (s.status !== "running" ? s : banked(s, Date.now())));
    haptics.tap();
  }, []);

  /** Clears the ACTIVE mode only — the other keeps its own configuration. */
  const reset = React.useCallback(() => {
    setNow(Date.now());
    announced.current = true; // don't announce a reset back-to-zero run
    setState((s) =>
      s.mode === "countdown"
        ? {
            ...s,
            status: s.countdown.totalMs > 0 ? "idle" : "finished",
            countdown: { ...s.countdown, remainingMs: s.countdown.totalMs, endsAt: null },
          }
        : { ...s, status: "idle", stopwatch: { elapsedMs: 0, runStartedAt: null } }
    );
    haptics.tap();
  }, []);

  /** Stop and put the timer away entirely — the pill disappears. */
  const close = React.useCallback(() => {
    setState(INITIAL);
    announced.current = false;
    setPanelOpen(false);
    haptics.close();
  }, []);

  const openPanel = React.useCallback(() => setPanelOpen(true), []);
  const closePanel = React.useCallback(() => setPanelOpen(false), []);

  const value = React.useMemo<TimerContextValue>(
    () => ({
      ...state,
      displayMs,
      totalMs: state.mode === "countdown" ? state.countdown.totalMs : 0,
      hydrated,
      panelOpen,
      // The pill earns its place whenever the timer is engaged: running,
      // paused, or freshly finished. A pristine idle timer stays hidden.
      active:
        hydrated &&
        (state.status !== "idle" ||
          (state.mode === "stopwatch" && state.stopwatch.elapsedMs > 0)),
      openPanel,
      closePanel,
      setMode,
      setDuration,
      start,
      pause,
      reset,
      close,
    }),
    [
      state, displayMs, hydrated, panelOpen,
      openPanel, closePanel, setMode, setDuration, start, pause, reset, close,
    ]
  );

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const ctx = React.useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}

/** Split ms into padded hour / minute / second parts. */
export function splitTime(ms: number): { h: string; m: string; s: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}