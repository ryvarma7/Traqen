"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { TrackTaskRow } from "@/components/tracks/track-task-row";
import { formatShortDate } from "@/lib/dates";
import { haptics } from "@/lib/haptics";
import type { PhaseProgress } from "@/lib/track-plan";
import type { TrackItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** State glyph for a phase: a tick once every step is done, a filled ring on
 *  the current phase, a hollow ring ahead of it. The number lives in the
 *  stepper above, so the rows don't repeat it. */
function PhaseDot({
  state,
  className,
}: {
  state: PhaseProgress["state"];
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
        state === "done" && "border-white bg-white text-black",
        state === "current" && "border-white bg-black",
        state === "upcoming" && "border-white/25 bg-black",
        className
      )}
    >
      {state === "done" ? (
        <Check className="h-4 w-4" strokeWidth={3} />
      ) : state === "current" ? (
        <span className="h-2 w-2 rounded-full bg-white" />
      ) : null}
    </span>
  );
}

function DateRange({ range }: { range: PhaseProgress["range"] }) {
  if (!range) return null;
  const label =
    range.first === range.last
      ? formatShortDate(range.first)
      : `${formatShortDate(range.first)} – ${formatShortDate(range.last)}`;
  return (
    <span className="shrink-0 whitespace-nowrap font-mono text-2xs tabular-nums text-muted-foreground/80">
      {label}
    </span>
  );
}

/* ── Mobile: one phase open at a time ───────────────────────────────────── */

export function PhaseAccordion({
  progress,
  openId,
  onSelect,
  busyIds,
  onItemToggle,
}: {
  progress: PhaseProgress[];
  openId: string | null;
  onSelect: (id: string) => void;
  busyIds: Set<string>;
  onItemToggle: (item: TrackItem) => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-1.5">
      {progress.map((p) => {
        const open = openId === p.phase.id;
        const complete = p.state === "done";

        return (
          <div
            key={p.phase.id}
            className={cn(
              // No overflow-hidden here: the expanding panel clips itself, so
              // the header's focus ring is never cut off by the tile.
              "rounded-field glass-tile transition-colors",
              open && "border-white/25"
            )}
          >
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                onSelect(p.phase.id);
              }}
              aria-expanded={open}
              className="focus-ring flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
            >
              <PhaseDot state={p.state} />

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-[0.9375rem] leading-tight",
                    p.state === "done" ? "text-muted-foreground" : "font-medium text-foreground"
                  )}
                >
                  <span className="text-muted-foreground">Phase {p.index + 1} · </span>
                  {p.phase.title}
                </span>
                <span className="mt-0.5 block font-mono text-2xs tabular-nums text-muted-foreground">
                  {p.done}/{p.total} done
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-2">
                <DateRange range={p.range} />
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    open && "rotate-180"
                  )}
                />
              </span>
            </button>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduceMotion ? { height: 0, opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 px-3 pb-3">
                    {p.phase.description && (
                      <p className="pb-0.5 text-sm leading-relaxed text-muted-foreground">
                        {p.phase.description}
                      </p>
                    )}
                    {p.items.length === 0 ? (
                      <p className="py-2 text-sm text-muted-foreground">
                        No steps in this phase.
                      </p>
                    ) : (
                      p.items.map((item) => (
                        <TrackTaskRow
                          key={item.id}
                          item={item}
                          busy={busyIds.has(item.id)}
                          onToggle={onItemToggle}
                        />
                      ))
                    )}
                    {complete && (
                      <p className="text-xs font-medium text-muted-foreground">
                        Phase complete.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ── Desktop: sticky rail + selected phase in the right pane ────────────── */

export function PhaseRail({
  progress,
  selectedId,
  onSelect,
}: {
  progress: PhaseProgress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Track phases"
      className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto pr-1 md:block"
    >
      <p className="px-2 pb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        Phases
      </p>
      <ul className="space-y-1">
        {progress.map((p) => {
          const selected = p.phase.id === selectedId;
          const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;

          return (
            <li key={p.phase.id}>
              <button
                type="button"
                onClick={() => {
                  haptics.selection();
                  onSelect(p.phase.id);
                }}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "focus-ring flex w-full items-start gap-2.5 rounded-field px-2.5 py-2 text-left transition-colors",
                  selected ? "bg-white/8" : "hover:bg-white/5"
                )}
              >
                <PhaseDot state={p.state} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm leading-snug",
                      selected ? "font-semibold text-foreground" : "text-foreground/90"
                    )}
                  >
                    {p.phase.title}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1 w-14 overflow-hidden rounded-full bg-white/10">
                      <motion.span
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="block h-full rounded-full bg-white"
                      />
                    </span>
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                      {p.done}/{p.total}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PhaseTasks({
  progress,
  busyIds,
  onItemToggle,
}: {
  progress: PhaseProgress | undefined;
  busyIds: Set<string>;
  onItemToggle: (item: TrackItem) => void;
}) {
  if (!progress) return null;
  const complete = progress.state === "done";

  return (
    <section className="rounded-card glass-section p-4 md:p-5" aria-label={`${progress.phase.title} steps`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Phase {progress.index + 1}
          </p>
          <h2 className="mt-0.5 break-words text-lg font-semibold tracking-tight text-foreground">
            {progress.phase.title}
          </h2>
        </div>
        <DateRange range={progress.range} />
      </div>

      {progress.phase.description && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {progress.phase.description}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {progress.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No steps in this phase.
          </p>
        ) : (
          progress.items.map((item) => (
            <TrackTaskRow
              key={item.id}
              item={item}
              busy={busyIds.has(item.id)}
              onToggle={onItemToggle}
            />
          ))
        )}
      </div>

      {complete && progress.total > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Check className="h-3.5 w-3.5" /> Phase complete.
        </p>
      )}
    </section>
  );
}