"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Timer } from "lucide-react";
import { TimerPanelBody } from "@/components/shell/timer-panel";
import { TimerReadout } from "@/components/shell/timer-readout";
import { useTimer } from "@/lib/timer-store";
import { haptics } from "@/lib/haptics";
import { useIsMobile } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/**
 * Top-bar entry point. Sits with the other nav actions and is the one place
 * the timer is configured on desktop, where it opens a dropdown anchored
 * under the button.
 *
 * On mobile it is a plain trigger — the bottom sheet is owned by TimerPill so
 * that exactly one modal exists regardless of which control opened it. Once
 * the timer is engaged the floating pill takes over as the always-visible
 * readout, because this bar scrolls away with the page.
 */
export function TimerButton() {
  const isMobile = useIsMobile();
  const { panelOpen, openPanel, closePanel, status, displayMs, mode } = useTimer();
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!panelOpen || isMobile) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePanel();
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closePanel();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [panelOpen, isMobile, closePanel]);

  const engaged = status !== "idle";

  const toggle = () => {
    haptics.tap();
    if (panelOpen) closePanel();
    else openPanel();
  };

  return (
    <div className="relative" ref={rootRef}>
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
        aria-label={
          engaged ? `Timer ${mode === "countdown" ? "countdown" : "stopwatch"} — open controls` : "Start a timer"
        }
        onClick={toggle}
        className={cn(
          "glass-btn-base glass-btn-outline flex h-10 items-center justify-center gap-1.5 rounded-field px-2.5 transition-all md:h-9 md:min-w-9 md:px-3 md:text-sm md:font-medium",
          engaged && "border-white/30 text-foreground"
        )}
      >
        <Timer className="h-4 w-4 shrink-0 text-muted-foreground md:h-3.5 md:w-3.5" />
        {engaged ? (
          // A live tick here too, so the control itself reads as active even
          // before the pill is on screen.
          <span className="hidden md:inline">
            <TimerReadout ms={displayMs} size="sm" className="text-sm leading-none" />
          </span>
        ) : (
          <span className="hidden md:inline">Timer</span>
        )}
      </motion.button>

      {!isMobile && (
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              role="dialog"
              aria-label="Timer"
              className="glass-modal absolute right-0 top-full z-50 mt-2 w-[340px] origin-top-right overflow-hidden rounded-card"
            >
              <TimerPanelBody />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}