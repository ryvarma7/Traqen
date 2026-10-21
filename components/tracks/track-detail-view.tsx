"use client";

import * as React from "react";
import { motion, MotionConfig } from "framer-motion";
import { ArrowLeft, Flag, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { ConfirmDialog } from "@/components/tracks/confirm-dialog";
import { beginNav } from "@/components/shell/nav-loader";
import { PhaseAccordion, PhaseTasks } from "@/components/tracks/phase-list";
import { PhaseSheet } from "@/components/tracks/phase-sheet";
import { RescheduleSheet } from "@/components/tracks/reschedule-sheet";
import { StepSheet } from "@/components/tracks/step-sheet";
import { TrackMenu } from "@/components/tracks/track-menu";
import { TrackPhaseStepper } from "@/components/tracks/track-phase-stepper";
import { UpNextCard } from "@/components/tracks/up-next-card";
import {
  deleteTrack,
  setTrackItemStatus,
  setTrackStatus,
} from "@/lib/actions/tracks";
import { formatShortDate, relativeDays } from "@/lib/dates";
import { haptics } from "@/lib/haptics";
import { useIsMobile } from "@/lib/hooks";
import { buildPhaseProgress, nextDueItem, paceOf, upNextItem } from "@/lib/track-plan";
import type { LearningTrack, TrackItem, TrackPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

/** How long the "Step completed / Undo" toast stays up. Long enough to notice
 *  a mis-tap on a one-button action, short enough not to linger over the next
 *  step. */
const STEP_UNDO_MS = 6000;

/** Per-step toast id, so undoing dismisses its own confirmation rather than
 *  every toast on screen. */
const trackToastId = (itemId: string) => `track-step-done-${itemId}`;

/** Which step sheet is open, and what it is editing. */
type StepSheetState =
  | { mode: "create"; phaseId: string }
  | { mode: "edit"; item: TrackItem }
  | null;

/** Which phase sheet is open, and what it is editing. */
type PhaseSheetState =
  | { mode: "create" }
  | { mode: "edit"; phase: TrackPhase }
  | null;

/** The shared provider also handles blur and entrance-delay preferences. */
export function TrackDetailView(
  props: {
    track: LearningTrack;
    phases: TrackPhase[];
    items: TrackItem[];
  }
) {
  return (
    <MotionConfig reducedMotion="user">
      <TrackDetail {...props} />
    </MotionConfig>
  );
}

function TrackDetail({
  track,
  phases,
  items,
}: {
  track: LearningTrack;
  phases: TrackPhase[];
  items: TrackItem[];
}) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const [localItems, setLocalItems] = React.useState(items);
  const [localPhases, setLocalPhases] = React.useState(phases);
  const [localTrack, setLocalTrack] = React.useState(track);
  const [busyIds, setBusyIds] = React.useState<Set<string>>(() => new Set());
  const [statusBusy, setStatusBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [rescheduling, setRescheduling] = React.useState(false);
  const [stepSheet, setStepSheet] = React.useState<StepSheetState>(null);
  const [phaseSheet, setPhaseSheet] = React.useState<PhaseSheetState>(null);

  // A change made elsewhere — an edit in a sheet, say — comes back as new
  // props. The local copies are re-synced from them, but never while a write
  // is in flight, so an optimistic update is never overwritten by a
  // response that predates it.
  const busyRef = React.useRef(busyIds);
  busyRef.current = busyIds;
  React.useEffect(() => {
    if (busyRef.current.size > 0) return;
    setLocalItems(items);
    setLocalPhases(phases);
  }, [items, phases]);

  // Everything below is derived, never stored — the header, the stepper, the
  // "up next" card and the phase list all read from the same two arrays, so
  // they cannot disagree with each other after an optimistic update.
  const progress = React.useMemo(
    () => buildPhaseProgress(localPhases, localItems),
    [localPhases, localItems]
  );
  const next = React.useMemo(() => upNextItem(progress), [progress]);
  const nextPhase =
    progress.find((p) => p.items.some((i) => i.id === next?.id)) ?? null;
  const pace = React.useMemo(() => paceOf(localItems), [localItems]);
  const nextDue = React.useMemo(() => nextDueItem(localItems), [localItems]);

  const done = localItems.filter((i) => i.status === "Done").length;
  const total = localItems.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // "Current" is always the first phase with an open item; once the whole
  // track is done we fall back to the first phase so the panes stay populated.
  const currentPhaseId = progress.find((p) => p.state === "current")?.phase.id ?? null;
  const [selectedId, setSelectedId] = React.useState<string | null>(
    currentPhaseId ?? progress[0]?.phase.id ?? null
  );
  const [openPhaseId, setOpenPhaseId] = React.useState<string | null>(currentPhaseId);

  // The mobile accordion always tracks the derived current phase ("only the
  // current phase is expanded"). The desktop pane follows the plan forward as
  // phases get finished — otherwise finishing phase 1 left the pane below
  // "Mark done" still showing the now-complete phase 1 — but a deliberate
  // focus on a phase that still has work open is left alone.
  React.useEffect(() => {
    if (!currentPhaseId) return;
    setOpenPhaseId(currentPhaseId);
    setSelectedId((prev) => {
      if (prev === null) return currentPhaseId;
      const shown = progress.find((p) => p.phase.id === prev);
      return shown && shown.state !== "done" ? prev : currentPhaseId;
    });
  }, [currentPhaseId, progress]);

  const focusPhase = (id: string) => {
    setSelectedId(id);
    setOpenPhaseId(id);
  };

  const editStep = (item: TrackItem) => setStepSheet({ mode: "edit", item });
  const addStep = (phaseId: string) => setStepSheet({ mode: "create", phaseId });
  const editPhase = (phase: TrackPhase) => setPhaseSheet({ mode: "edit", phase });
  const addPhase = () => setPhaseSheet({ mode: "create" });

  /** Optimistic done / not-done toggle with a rollback if the write fails.
   *
   *  Marking a step done is one tap and instantly rewrites the "Up next" card
   *  to a different task, so the row the user hit is gone from view before
   *  they've registered the tap. The undo toast is the way back for a
   *  mis-tap; the phase list below still shows the step struck through. */
  const toggleItem = async (item: TrackItem) => {
    if (busyIds.has(item.id)) return;
    const nextStatus: TrackItem["status"] = item.status === "Done" ? "To do" : "Done";
    const previous = localItems;

    setLocalItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i))
    );
    setBusyIds((prev) => new Set(prev).add(item.id));

    const result = await setTrackItemStatus(item.id, nextStatus);
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });

    if (result.error) {
      setLocalItems(previous); // rollback
      haptics.error();
      toast.error(result.error);
      return;
    }

    if (nextStatus === "Done") {
      haptics.success();
      toast("Step completed", {
        id: trackToastId(item.id),
        description: item.title,
        action: {
          label: "Undo",
          onClick: () => void toggleItem({ ...item, status: "Done" }),
        },
        duration: STEP_UNDO_MS,
      });
    } else {
      haptics.tapLight();
    }

    // Mirror the server's rule in both directions so the header stays honest:
    // all done -> Completed, anything else -> In progress. The server's update
    // carries a `.neq("status", "On hold")` guard, so an On-hold track is left
    // alone on both sides.
    const updated = localItems.map((i) =>
      i.id === item.id ? { ...i, status: nextStatus } : i
    );
    const complete = updated.length > 0 && updated.every((i) => i.status === "Done");
    const nextTrackStatus = complete ? "Completed" : "In progress";
    setLocalTrack((t) =>
      t.status === "On hold" ? t : { ...t, status: nextTrackStatus }
    );
  };

  /** Applies the server's date shift locally so the schedule updates without
   *  waiting on a router refresh. */
  const applyReschedule = (shift: Map<string, string>) => {
    if (shift.size === 0) return;
    setLocalItems((prev) =>
      prev.map((i) =>
        shift.has(i.id) ? { ...i, target_date: shift.get(i.id)! } : i
      )
    );
  };

  const changeTrackStatus = async (status: LearningTrack["status"]) => {
    if (statusBusy) return;
    setStatusBusy(true);
    setLocalTrack((t) => ({ ...t, status }));
    const result = await setTrackStatus(localTrack.id, status);
    setStatusBusy(false);
    if (result.error) {
      haptics.error();
      toast.error(result.error);
      return;
    }
    haptics.toggle(status !== "On hold");
  };

  const remove = async () => {
    setDeleting(true);
    const result = await deleteTrack(localTrack.id);
    setDeleting(false);
    if (result.error) {
      haptics.error();
      toast.error(result.error);
      return;
    }
    haptics.delete();
    setConfirmDelete(false);
    toast.success("Track deleted");
    beginNav();
    router.push("/tracks");
  };

  const menu = (
    <TrackMenu
      onReschedule={() => setRescheduling(true)}
      {...(localTrack.status === "On hold"
        ? { onResume: () => changeTrackStatus("In progress") }
        : { onHold: () => changeTrackStatus("On hold") })}
      onDelete={() => setConfirmDelete(true)}
    />
  );

  const overlays = (
    <Overlays
      track={localTrack}
      confirmingDelete={confirmDelete}
      deleting={deleting}
      onCancelDelete={() => setConfirmDelete(false)}
      onConfirmDelete={remove}
      items={localItems}
      rescheduling={rescheduling}
      onRescheduleClose={() => setRescheduling(false)}
      onRescheduleApplied={applyReschedule}
      phases={localPhases}
      stepSheet={stepSheet}
      onStepSheetClose={() => setStepSheet(null)}
      phaseSheet={phaseSheet}
      onPhaseSheetClose={() => setPhaseSheet(null)}
    />
  );

  if (localPhases.length === 0 || total === 0) {
    return (
      <div className="space-y-5">
        <Header
          track={localTrack}
          pct={pct}
          done={done}
          total={total}
          pace={pace}
          nextDue={nextDue}
          menu={menu}
        />
        <EmptyState onAddPhase={addPhase} />
        {overlays}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header
        track={localTrack}
        pct={pct}
        done={done}
        total={total}
        pace={pace}
        nextDue={nextDue}
        menu={menu}
      />

      <TrackPhaseStepper progress={progress} selectedId={selectedId} onSelect={focusPhase} />

      {/* ── Desktop: the plan, full width ───────────────────────────────────
          The stepper above is the only list of phases on this layout. There
          used to be a sticky rail beside the plan listing the same phases,
          which meant two navigators for one list and a plan squeezed into
          the leftover width. */}
      <div className="min-w-0 space-y-5">
        <UpNextCard
          item={next}
          phase={nextPhase?.phase ?? null}
          totalItems={total}
          busy={next ? busyIds.has(next.id) : false}
          onMarkDone={toggleItem}
        />

        {!isMobile && <div className="hidden md:block">
          <PhaseTasks
            progress={progress.find((p) => p.phase.id === selectedId)}
            busyIds={busyIds}
            onItemToggle={toggleItem}
            onItemEdit={editStep}
            onAddStep={addStep}
            onEditPhase={editPhase}
          />
        </div>}
      </div>

      {/* ── Mobile: the same plan, one phase at a time ───────────────────── */}
      {isMobile && <div className="md:hidden">
        <PhaseAccordion
          progress={progress}
          openId={openPhaseId}
          onSelect={(id) => {
            setOpenPhaseId((prev) => (prev === id ? null : id));
            setSelectedId(id);
          }}
          busyIds={busyIds}
          onItemToggle={toggleItem}
          onItemEdit={editStep}
          onAddStep={addStep}
          onEditPhase={editPhase}
        />
      </div>}

      {/* A phase of the learner's own. It sits below the plan rather than
          inside it, so it never looks like part of the generated course. */}
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          addPhase();
        }}
        className="focus-ring flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-white/15 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
        Add a phase
      </button>

      {overlays}
    </div>
  );
}

/* ── Header ─────────────────────────────────────────────────────────────── */

function Header({
  track,
  pct,
  done,
  total,
  pace,
  nextDue,
  menu,
}: {
  track: LearningTrack;
  pct: number;
  done: number;
  total: number;
  pace: { behindDays: number; overdueCount: number };
  nextDue: { item: TrackItem; days: number } | null;
  menu: React.ReactNode;
}) {
  const reduceMotion = useMotionPreferences();

  return (
    <header className="rounded-card glass-section p-4 md:p-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href="/tracks"
            onClick={() => haptics.tap()}
            className="focus-ring focus-visible:outline-offset-4 -ml-1 mb-2.5 inline-flex items-center gap-1.5 rounded-field px-1 py-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All tracks
          </Link>
          <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {track.title}
          </h1>
          <TrackDescription text={track.description} />
        </div>

        <div className="shrink-0 pt-0.5">{menu}</div>
      </div>

      {/* Progress */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="font-mono text-sm tabular-nums text-foreground">
            {done}/{total} tasks
            <span className="text-muted-foreground"> · </span>
            <span className="text-muted-foreground">{pct}%</span>
          </p>
          <PaceChip pace={pace} />
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Track progress"
        >
          <motion.div
            initial={false}
            animate={{ scaleX: pct / 100 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
            className="h-full w-full origin-left rounded-full bg-white"
          />
        </div>
      </div>

      {/* Next deadline */}
      {nextDue && (
        <p className="mt-3 flex items-baseline gap-1.5 text-sm text-muted-foreground">
          <span className="shrink-0">Next due</span>
          <span className="min-w-0 flex-1 truncate text-foreground/90">
            {nextDue.item.title}
          </span>
          <span className="shrink-0 font-mono tabular-nums">
            · {relativeDays(nextDue.days)}
          </span>
        </p>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="shrink-0">Plan window</span>
        <span className="font-mono tabular-nums text-foreground/90">
          {formatShortDate(track.start_date)}
          {track.end_date ? ` – ${formatShortDate(track.end_date)}` : ""}
        </span>
      </p>

      {track.status === "On hold" && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-field border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-muted-foreground">
          <Flag className="h-3 w-3" /> This track is on hold — resume when
          you&apos;re ready.
        </p>
      )}
    </header>
  );
}

function PaceChip({ pace }: { pace: { behindDays: number; overdueCount: number } }) {
  const behind = pace.behindDays > 0;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        behind
          ? "border-warning-border/70 bg-warning-soft/80 text-warning"
          : "border-success-border/70 bg-success-soft/80 text-success"
      )}
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", behind ? "bg-warning" : "bg-success")}
      />
      {behind
        ? `${pace.behindDays} ${pace.behindDays === 1 ? "day" : "days"} behind`
        : "On track"}
    </span>
  );
}

/** Two lines by default with a "more" toggle, so a long AI-written blurb can
 *  never push the header off the first screen. */
function TrackDescription({ text }: { text: string | null }) {
  const [expanded, setExpanded] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);
  const ref = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    setExpanded(false);
  }, [text]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  if (!text) return null;

  return (
    <div className="mt-2">
      <p
        ref={ref}
        className={cn(
          "break-words text-sm leading-relaxed text-muted-foreground md:text-base",
          !expanded && "line-clamp-2"
        )}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => {
            haptics.tap();
            setExpanded((v) => !v);
          }}
          className="focus-ring mt-1 rounded-field text-sm font-medium text-foreground/75 hover:text-foreground"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function EmptyState({ onAddPhase }: { onAddPhase: () => void }) {
  return (
    <div className="rounded-card glass-section flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </span>
      <div>
        <p className="text-base font-semibold text-foreground">This plan is empty</p>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
          There are no phases or steps on this track yet. Add a phase and start
          building the plan yourself.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          onAddPhase();
        }}
        className="glass-btn-base glass-btn-primary mt-1 flex h-10 items-center gap-2 rounded-field px-4 text-sm"
      >
        <Plus className="h-4 w-4" /> Add a phase
      </button>
    </div>
  );
}

/* ── Dialogs & sheets ───────────────────────────────────────────────────── */

function Overlays({
  track,
  confirmingDelete,
  deleting,
  onCancelDelete,
  onConfirmDelete,
  items,
  rescheduling,
  onRescheduleClose,
  onRescheduleApplied,
  phases,
  stepSheet,
  onStepSheetClose,
  phaseSheet,
  onPhaseSheetClose,
}: {
  track: LearningTrack;
  confirmingDelete: boolean;
  deleting: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  items: TrackItem[];
  rescheduling: boolean;
  onRescheduleClose: () => void;
  onRescheduleApplied: (shift: Map<string, string>) => void;
  phases: TrackPhase[];
  stepSheet: StepSheetState;
  onStepSheetClose: () => void;
  phaseSheet: PhaseSheetState;
  onPhaseSheetClose: () => void;
}) {
  const editingPhase =
    phaseSheet?.mode === "edit" ? phaseSheet.phase : null;
  const stepCount = editingPhase
    ? items.filter((item) => item.phase_id === editingPhase.id).length
    : 0;

  return (
    <>
      <RescheduleSheet
        open={rescheduling}
        onClose={onRescheduleClose}
        trackId={track.id}
        items={items}
        onApplied={onRescheduleApplied}
      />

      <StepSheet
        open={stepSheet !== null}
        onClose={onStepSheetClose}
        trackId={track.id}
        phaseId={
          stepSheet?.mode === "create" ? stepSheet.phaseId : phases[0]?.id ?? ""
        }
        phases={phases}
        item={stepSheet?.mode === "edit" ? stepSheet.item : null}
      />

      <PhaseSheet
        open={phaseSheet !== null}
        onClose={onPhaseSheetClose}
        trackId={track.id}
        phase={editingPhase}
        stepCount={stepCount}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onClose={onCancelDelete}
        onConfirm={onConfirmDelete}
        busy={deleting}
        title={`Delete "${track.title}"?`}
        confirmLabel="Delete track"
        body={
          <p>
            This permanently removes the track and all of its phases and steps.
            This can&apos;t be undone.
          </p>
        }
      />
    </>
  );
}
