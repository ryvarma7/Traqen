"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { TrackItemRow } from "@/components/tracks/track-item-row";
import { formatShortDate } from "@/lib/dates";
import type { TrackItem, TrackPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Vertical phase timeline — the default "roadmap" view. A spine runs down
 *  the left; each phase is a node, each item a checkable card. The current
 *  phase (first one with open items) gets a live "today" ring. */
export function TimelineView({
  phases,
  items,
  onItemChange,
}: {
  phases: TrackPhase[];
  items: TrackItem[];
  onItemChange: (id: string, next: TrackItem["status"]) => void;
}) {
  // First phase that still has an open item = the "current" node.
  const currentPhaseId = React.useMemo(() => {
    for (const phase of phases) {
      const phaseItems = items.filter((i) => i.phase_id === phase.id);
      if (phaseItems.some((i) => i.status !== "Done")) return phase.id;
    }
    return null;
  }, [phases, items]);

  return (
    <div className="relative">
      {/* Spine */}
      <div
        aria-hidden
        className="absolute bottom-4 left-[15px] top-2 w-px bg-gradient-to-b from-white/30 via-white/15 to-transparent"
      />

      <div className="space-y-7">
        {phases.map((phase, pi) => {
          const phaseItems = items
            .filter((i) => i.phase_id === phase.id)
            .sort((a, b) => a.position - b.position);
          const done = phaseItems.filter((i) => i.status === "Done").length;
          const allDone = done === phaseItems.length;
          const isCurrent = phase.id === currentPhaseId;

          return (
            <PhaseNode
              key={phase.id}
              phase={phase}
              index={pi}
              items={phaseItems}
              done={done}
              allDone={allDone}
              isCurrent={isCurrent}
              onItemChange={onItemChange}
            />
          );
        })}
      </div>
    </div>
  );
}

function PhaseNode({
  phase,
  index,
  items,
  done,
  allDone,
  isCurrent,
  onItemChange,
}: {
  phase: TrackPhase;
  index: number;
  items: TrackItem[];
  done: number;
  allDone: boolean;
  isCurrent: boolean;
  onItemChange: (id: string, next: TrackItem["status"]) => void;
}) {
  const [open, setOpen] = React.useState(isCurrent || !allDone);

  // Collapse fully-done phases by default once they're no longer current.
  React.useEffect(() => {
    if (!isCurrent && allDone) setOpen(false);
    if (isCurrent) setOpen(true);
  }, [isCurrent, allDone]);

  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
  // Date range for the phase header.
  const dated = items.filter((i) => i.target_date);
  const first = dated.length
    ? dated.reduce((a, b) => (a.target_date! <= b.target_date! ? a : b)).target_date
    : null;
  const last = dated.length
    ? dated.reduce((a, b) => (a.target_date! >= b.target_date! ? a : b)).target_date
    : null;

  return (
    <div className="relative pl-11">
      {/* Node dot on the spine */}
      <div className="absolute left-0 top-1">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs font-semibold tabular-nums transition-colors",
            allDone
              ? "border-white bg-white text-black"
              : isCurrent
                ? "border-white bg-black text-white"
                : "border-white/25 bg-black text-muted-foreground"
          )}
        >
          {allDone ? "✓" : index + 1}
        </div>
        {isCurrent && (
          <span
            aria-hidden
            className="absolute inset-0 -m-1 animate-ping rounded-full border border-white/40 opacity-60"
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="break-words text-sm font-semibold text-foreground">
              {phase.title}
            </h3>
            {isCurrent && (
              <span className="shrink-0 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-2xs font-medium text-foreground">
                Now
              </span>
            )}
          </div>
          {phase.description && open && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {phase.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            {/* Phase progress bar */}
            <div className="h-1 w-28 overflow-hidden rounded-full bg-white/8 md:w-40">
              <motion.div
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="h-full rounded-full bg-white"
              />
            </div>
            <span className="font-mono text-2xs tabular-nums text-muted-foreground">
              {done}/{items.length}
            </span>
            {first && last && (
              <span className="hidden font-mono text-2xs tabular-nums text-muted-foreground/70 md:inline">
                {formatShortDate(first)} – {formatShortDate(last)}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <TrackItemRow
                  key={item.id}
                  item={item}
                  onChange={(next) => onItemChange(item.id, next)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}