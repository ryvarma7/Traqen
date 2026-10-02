"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { haptics } from "@/lib/haptics";
import type { PhaseProgress } from "@/lib/track-plan";
import { cn } from "@/lib/utils";

/**
 * Horizontal phase stepper under the header. Scrolls on its own at phone
 * width; the selected phase is always scrolled into view, and the scroll is
 * applied to the container only so it can never drag the page sideways.
 */
export function TrackPhaseStepper({
  progress,
  selectedId,
  onSelect,
}: {
  progress: PhaseProgress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const nodeRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const reduceMotion = useReducedMotion();

  // Centre the selected phase without ever moving the document.
  React.useEffect(() => {
    if (!selectedId) return;
    const container = containerRef.current;
    const node = nodeRefs.current.get(selectedId);
    if (!container || !node) return;

    const left = node.offsetLeft - (container.clientWidth - node.offsetWidth) / 2;
    container.scrollTo({
      left: Math.max(0, left),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [selectedId, progress.length, reduceMotion]);

  if (progress.length === 0) return null;

  return (
    <nav
      aria-label="Track phases"
      ref={containerRef}
      className="relative flex overflow-x-auto no-scrollbar py-1"
    >
      {progress.map((p, i) => (
        <StepNode
          key={p.phase.id}
          ref={(el) => {
            if (el) nodeRefs.current.set(p.phase.id, el);
            else nodeRefs.current.delete(p.phase.id);
          }}
          progress={p}
          selected={p.phase.id === selectedId}
          first={i === 0}
          last={i === progress.length - 1}
          onSelect={() => {
            haptics.selection();
            onSelect(p.phase.id);
          }}
        />
      ))}
    </nav>
  );
}

const StepNode = React.forwardRef<
  HTMLButtonElement,
  {
    progress: PhaseProgress;
    selected: boolean;
    first: boolean;
    last: boolean;
    onSelect: () => void;
  }
>(function StepNode({ progress, selected, first, last, onSelect }, ref) {
  const { state, index, done, total, phase } = progress;
  const isDone = state === "done";
  const isCurrent = state === "current";

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-current={isCurrent ? "step" : undefined}
      className={cn(
        "focus-ring flex w-[104px] shrink-0 flex-col items-center gap-1.5 rounded-field px-1 py-1.5 transition-colors sm:w-[136px]",
        selected ? "bg-white/8" : "hover:bg-white/5"
      )}
    >
      {/*
        Wires live inside the node and share one flex row with the circle, so
        they always meet it dead-centre at any width — no drifting halo ring.
      */}
      <span className="flex items-center self-stretch">
        {!first && (
          <span
            aria-hidden
            className={cn("h-px flex-1", isDone ? "bg-white/45" : "bg-white/15")}
          />
        )}
        <motion.span
          initial={false}
          animate={{ scale: selected ? 1.05 : 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold tabular-nums transition-colors",
            isDone && "border-white bg-white text-black",
            isCurrent && "border-white bg-black text-foreground",
            state === "upcoming" && "border-white/25 bg-black text-muted-foreground"
          )}
        >
          {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
        </motion.span>
        {!last && (
          <span aria-hidden className="h-px flex-1 bg-white/15" />
        )}
      </span>

      <span
        className={cn(
          "w-full truncate text-center text-xs leading-tight",
          selected ? "font-semibold text-foreground" : "text-foreground/85"
        )}
      >
        {phase.title}
      </span>

      <span className="font-mono text-2xs tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </button>
  );
});