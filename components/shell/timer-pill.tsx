"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ModalShell } from "@/components/shared/modal-shell";
import { TimerPanelBody } from "@/components/shell/timer-panel";
import { TimerReadout } from "@/components/shell/timer-readout";
import { useTimer } from "@/lib/timer-store";
import { haptics } from "@/lib/haptics";
import { useIsMobile } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/**
 * The minimized running timer. Fixed to the bottom-LEFT so it can never
 * collide with the FAB that already owns the bottom-right corner on the pages
 * that have one. Only exists while the timer is engaged — start one and it
 * springs in, close it and it leaves.
 *
 * This component also owns the single bottom sheet, whichever control opened
 * it. Keeping one owner is what stops the header trigger and the pill from
 * stacking two modals on top of each other on a phone.
 */
export function TimerPill() {
  const isMobile = useIsMobile();
  const {
    active, panelOpen, openPanel, closePanel,
    mode, status, displayMs, totalMs,
  } = useTimer();

  const running = status === "running";
  const finished = status === "finished";

  // Countdown sweep: how much of the configured run is left. A stopwatch has
  // no total, so its ring just sits idle behind the readout.
  const progress =
    mode === "countdown" && totalMs > 0
      ? Math.max(0, Math.min(1, displayMs / totalMs))
      : 0;

  const R = 9;
  const CIRC = 2 * Math.PI * R;

  return (
    <>
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="fixed z-40"
            style={{
              bottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.75rem))",
              left: "max(1rem, env(safe-area-inset-left))",
            }}
          >
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={() => {
                haptics.tap();
                openPanel();
              }}
              aria-label={`${mode === "countdown" ? "Countdown" : "Stopwatch"} ${
                running ? "running" : finished ? "finished" : "paused"
              } — open controls`}
              className="focus-ring glass-btn-base glass-btn-outline flex h-12 items-center gap-2.5 rounded-full pl-3 pr-4"
            >
              <span className="relative flex h-6 w-6 items-center justify-center">
                <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="12" cy="12" r={R} className="fill-none stroke-white/15" strokeWidth="2" />
                  <circle
                    cx="12" cy="12" r={R}
                    className={cn(
                      "fill-none transition-[stroke] duration-500",
                      finished ? "stroke-success" : "stroke-foreground"
                    )}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - progress)}
                  />
                </svg>
                {running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />}
              </span>

              <TimerReadout
                ms={displayMs}
                size="sm"
                tone={finished ? "done" : "default"}
                className="text-base leading-none"
              />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        The sheet is mobile-only. On desktop the panel is the dropdown anchored
        to the top-bar trigger, so mounting an unconditional modal here too
        would stack a second copy of the whole panel over the first — which
        also swallowed every click, since its backdrop covered the dropdown.
        Exactly one presentation is mounted at a time.
      */}
      {isMobile && (
        <ModalShell open={panelOpen} onClose={closePanel} variant="sheet">
          <div role="dialog" aria-label="Timer">
            <TimerPanelBody />
          </div>
        </ModalShell>
      )}
    </>
  );
}