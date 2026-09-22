"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  Flag,
  ListTree,
  Network,
  PauseCircle,
  PlayCircle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DayView, WeekView } from "@/components/tracks/calendar-views";
import { NodeView } from "@/components/tracks/node-view";
import { TimelineView } from "@/components/tracks/timeline-view";
import { deleteTrack, setTrackStatus } from "@/lib/actions/tracks";
import { formatShortDate } from "@/lib/dates";
import type { LearningTrack, TrackItem, TrackPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewMode = "timeline" | "week" | "day" | "nodes";

const VIEWS: { id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "timeline", label: "Timeline", icon: ListTree },
  { id: "week", label: "Week", icon: CalendarRange },
  { id: "day", label: "Day", icon: CalendarDays },
  { id: "nodes", label: "Nodes", icon: Network },
];

export function TrackDetailView({
  track,
  phases,
  items,
}: {
  track: LearningTrack;
  phases: TrackPhase[];
  items: TrackItem[];
}) {
  const router = useRouter();
  const [view, setView] = React.useState<ViewMode>("timeline");
  const [localItems, setLocalItems] = React.useState(items);
  const [localTrack, setLocalTrack] = React.useState(track);
  const [statusBusy, setStatusBusy] = React.useState(false);

  // Optimistic status updates: patch local state instantly; the server
  // action already revalidates these paths for cross-device consistency.
  const onItemChange = (id: string, next: TrackItem["status"]) => {
    setLocalItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: next } : i)));
    // Keep the header percentage alive.
    const updated = localItems.map((i) => (i.id === id ? { ...i, status: next } : i));
    const allDone = updated.length > 0 && updated.every((i) => i.status === "Done");
    setLocalTrack((t) =>
      allDone && t.status !== "On hold" ? { ...t, status: "Completed" } : t
    );
  };

  const done = localItems.filter((i) => i.status === "Done").length;
  const inProgress = localItems.filter((i) => i.status === "In progress").length;
  const pct = localItems.length > 0 ? Math.round((done / localItems.length) * 100) : 0;

  const changeTrackStatus = async (status: LearningTrack["status"]) => {
    if (statusBusy) return;
    setStatusBusy(true);
    setLocalTrack((t) => ({ ...t, status }));
    const result = await setTrackStatus(localTrack.id, status);
    setStatusBusy(false);
    if (result.error) toast.error(result.error);
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${localTrack.title}" and all its steps? This can't be undone.`)) return;
    const result = await deleteTrack(localTrack.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Track deleted");
    router.push("/tracks");
  };

  return (
    <div>
      {/* ── Header card: back, title, stats, progress ─────────────────── */}
      <div className="rounded-card glass-section p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Link
              href="/tracks"
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All tracks
            </Link>
            <h1 className="break-words text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              {localTrack.title}
            </h1>
            {localTrack.description && (
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground md:text-sm">
                {localTrack.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {localTrack.status !== "On hold" ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => changeTrackStatus("On hold")}
                className="glass-btn-base glass-btn-outline h-9 rounded-field px-3 text-2xs font-medium text-muted-foreground"
              >
                <PauseCircle className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Put on hold</span>
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => changeTrackStatus("In progress")}
                className="glass-btn-base glass-btn-outline h-9 rounded-field px-3 text-2xs font-medium"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Resume</span>
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={remove}
              aria-label="Delete track"
              className="glass-btn-base glass-btn-ghost flex h-9 w-9 items-center justify-center rounded-field text-muted-foreground hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </motion.button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Stat label="Progress" value={`${pct}%`} />
          <Stat label="Completed" value={`${done}/${localItems.length}`} />
          <Stat label="In progress" value={String(inProgress)} />
          <Stat label="Started" value={formatShortDate(localTrack.start_date)} />
        </div>

        {/* Big animated progress bar */}
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <motion.div
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-white"
            />
          </div>
        </div>

        {localTrack.status === "On hold" && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-field border border-white/15 bg-white/5 px-2.5 py-1 text-2xs text-muted-foreground">
            <Flag className="h-3 w-3" /> This track is on hold — resume when you&apos;re ready.
          </p>
        )}
      </div>

      {/* ── View switcher ──────────────────────────────────────────────── */}
      <div className="mt-5 flex items-center gap-1 overflow-x-auto no-scrollbar rounded-field border border-white/10 bg-surface p-1">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              "relative flex h-9 min-w-[72px] flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 text-xs font-medium transition-colors",
              view === id ? "text-black" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {view === id && (
              <motion.span
                layoutId="track-view-pill"
                className="absolute inset-0 rounded-[7px] bg-white"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Active view ────────────────────────────────────────────────── */}
      <div className="mt-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {view === "timeline" && (
              <TimelineView phases={phases} items={localItems} onItemChange={onItemChange} />
            )}
            {view === "week" && (
              <WeekView phases={phases} items={localItems} onItemChange={onItemChange} />
            )}
            {view === "day" && (
              <DayView phases={phases} items={localItems} onItemChange={onItemChange} />
            )}
            {view === "nodes" && (
              <NodeView phases={phases} items={localItems} onItemChange={onItemChange} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-field border border-white/10 bg-black/40 px-3.5 py-2.5">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}