"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Pencil, Plus } from "lucide-react";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { TrackTaskRow } from "@/components/tracks/track-task-row";
import { formatShortDate } from "@/lib/dates";
import { haptics } from "@/lib/haptics";
import { blurIn, blurInTransition } from "@/lib/motion";
import type { PhaseProgress } from "@/lib/track-plan";
import type { TrackItem, TrackPhase } from "@/lib/types";
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
  onItemEdit,
  onAddStep,
  onEditPhase,
  unfoldedPhaseIds,
  onToggleUnfolded,
}: {
  progress: PhaseProgress[];
  openId: string | null;
  onSelect: (id: string) => void;
  busyIds: Set<string>;
  onItemToggle: (item: TrackItem) => void;
  onItemEdit?: (item: TrackItem) => void;
  onAddStep?: (phaseId: string) => void;
  onEditPhase?: (phase: TrackPhase) => void;
  /** Phases whose finished steps are unfolded. */
  unfoldedPhaseIds: Set<string>;
  onToggleUnfolded: (phaseId: string) => void;
}) {
  const reduceMotion = useMotionPreferences();
  const accordionId = React.useId();

  return (
    <div className="space-y-1.5">
      {progress.map((p) => {
        const open = openId === p.phase.id;
        const complete = p.state === "done";
        const headerId = `${accordionId}-${p.phase.id}-header`;
        const panelId = `${accordionId}-${p.phase.id}-panel`;

        return (
          <motion.div
            key={p.phase.id}
            layout={reduceMotion ? false : "position"}
            transition={reduceMotion ? { duration: 0 } : blurInTransition}
            className={cn(
              // Keep the header's focus ring outside the tile's content box.
              "rounded-field glass-tile transition-colors",
              open && "border-white/25"
            )}
          >
            <div className="flex items-center">
              <button
                type="button"
                id={headerId}
                onClick={() => {
                  haptics.selection();
                  onSelect(p.phase.id);
                }}
                aria-expanded={open}
                aria-controls={panelId}
                className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
              >
                <PhaseDot state={p.state} />

                <span className="min-w-0 flex-1">
                  {/*
                    The name gets two lines rather than one cut-off line: a
                    generated phase name is often a full sentence, and half
                    of it is not enough to recognise the phase by.
                  */}
                  <span
                    className={cn(
                      "line-clamp-2 break-words text-[0.9375rem] leading-tight",
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
                      "h-4 w-4 text-muted-foreground transition-transform motion-reduce:transition-none",
                      open && "rotate-180"
                    )}
                  />
                </span>
              </button>

              {onEditPhase && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onEditPhase(p.phase);
                  }}
                  aria-label={`Edit phase ${p.phase.title}`}
                  className="focus-ring -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-field text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {open && (
              <motion.div
                id={panelId}
                role="region"
                aria-labelledby={headerId}
                initial={reduceMotion ? false : blurIn.initial}
                animate={blurIn.animate}
                transition={reduceMotion ? { duration: 0 } : blurInTransition}
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
                    <PhaseItems
                      items={p.items}
                      busyIds={busyIds}
                      onItemToggle={onItemToggle}
                      onItemEdit={onItemEdit}
                      showDone={unfoldedPhaseIds.has(p.phase.id)}
                      onToggleDone={() => onToggleUnfolded(p.phase.id)}
                    />
                  )}
                  {onAddStep && (
                    <AddStepRow onClick={() => onAddStep(p.phase.id)} />
                  )}
                  {complete && (
                    <p className="text-xs font-medium text-muted-foreground">
                      Phase complete.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/** The dashed row that adds a step to a phase. */
function AddStepRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptics.tap();
        onClick();
      }}
      className="focus-ring flex w-full items-center gap-2.5 rounded-field border border-dashed border-white/15 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground"
    >
      <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      Add a step
    </button>
  );
}

/* ── A phase's steps ─────────────────────────────────────────────────────── */

/**
 * One phase's steps.
 *
 * The finished ones are folded into a single line — "3 completed steps" —
 * until the learner asks for them. Halfway through a plan, most of what a
 * phase holds is history, and every finished row is a full card of
 * struck-through text that pushes the steps still open off the screen.
 *
 * The open steps keep the order the plan gives them. The finished ones keep
 * their order relative to each other, behind the summary line, so nothing
 * about the phase is lost — it is only out of the way until it is wanted.
 */
function PhaseItems({
  items,
  busyIds,
  onItemToggle,
  onItemEdit,
  showDone,
  onToggleDone,
}: {
  items: TrackItem[];
  busyIds: Set<string>;
  onItemToggle: (item: TrackItem) => void;
  onItemEdit?: (item: TrackItem) => void;
  /** Whether the finished steps are unfolded. */
  showDone: boolean;
  onToggleDone: () => void;
}) {
  const reduceMotion = useMotionPreferences();
  const open = items.filter((item) => item.status !== "Done");
  const done = items.filter((item) => item.status === "Done");

  const row = (item: TrackItem) => (
    <TrackTaskRow
      key={item.id}
      item={item}
      busy={busyIds.has(item.id)}
      onToggle={onItemToggle}
      onEdit={onItemEdit}
    />
  );

  return (
    <div className="space-y-2">
      {open.map(row)}

      {showDone && done.length > 0 && (
        <motion.div
          initial={reduceMotion ? false : blurIn.initial}
          animate={blurIn.animate}
          transition={reduceMotion ? { duration: 0 } : blurInTransition}
          className="space-y-2"
        >
          {done.map(row)}
        </motion.div>
      )}

      {done.length > 0 && (
        <button
          type="button"
          onClick={() => {
            haptics.selection();
            onToggleDone();
          }}
          aria-expanded={showDone}
          className="focus-ring flex min-h-11 w-full items-center gap-2 rounded-field px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          <span className="flex-1 text-left">
            {done.length} completed {done.length === 1 ? "step" : "steps"}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none",
              showDone && "rotate-180"
            )}
          />
        </button>
      )}
    </div>
  );
}

export function PhaseTasks({
  progress,
  busyIds,
  onItemToggle,
  onItemEdit,
  onAddStep,
  onEditPhase,
  unfoldedPhaseIds,
  onToggleUnfolded,
}: {
  progress: PhaseProgress | undefined;
  busyIds: Set<string>;
  onItemToggle: (item: TrackItem) => void;
  onItemEdit?: (item: TrackItem) => void;
  onAddStep?: (phaseId: string) => void;
  onEditPhase?: (phase: TrackPhase) => void;
  /** Phases whose finished steps are unfolded. */
  unfoldedPhaseIds: Set<string>;
  onToggleUnfolded: (phaseId: string) => void;
}) {
  if (!progress) return null;
  const complete = progress.state === "done";

  return (
    <section className="rounded-card glass-section p-4 md:p-5" aria-label={`${progress.phase.title} steps`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Phase {progress.index + 1}
          </p>
          <h2 className="mt-0.5 break-words text-lg font-semibold tracking-tight text-foreground">
            {progress.phase.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DateRange range={progress.range} />
          {onEditPhase && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onEditPhase(progress.phase);
              }}
              aria-label={`Edit phase ${progress.phase.title}`}
              className="focus-ring -mr-1 flex h-9 w-9 items-center justify-center rounded-field text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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
          <PhaseItems
            items={progress.items}
            busyIds={busyIds}
            onItemToggle={onItemToggle}
            onItemEdit={onItemEdit}
            showDone={unfoldedPhaseIds.has(progress.phase.id)}
            onToggleDone={() => onToggleUnfolded(progress.phase.id)}
          />
        )}
        {onAddStep && <AddStepRow onClick={() => onAddStep(progress.phase.id)} />}
      </div>

      {complete && progress.total > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Check className="h-3.5 w-3.5" /> Phase complete.
        </p>
      )}
    </section>
  );
}
