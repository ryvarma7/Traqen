"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { GraduationCap, Plus } from "lucide-react";
import { toast } from "sonner";
import { ImportTrackModal } from "@/components/tracks/import-track-modal";
import { FabPlus } from "@/components/shared/fab-plus";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { TrackCard, type TrackCardData } from "@/components/tracks/track-card";
import { deleteTrack } from "@/lib/actions/tracks";
import { useCreateShortcut, usePendingCreate } from "@/lib/create-bus";
import { haptics } from "@/lib/haptics";
import { listVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type TrackSummary = TrackCardData & {
  created_at: string;
};

/** Which tracks the list shows. */
type FilterKey = "all" | "active" | "done";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];

/** How the tracks are ordered. */
type SortKey = "next" | "recent" | "progress";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "next", label: "Next up" },
  { key: "recent", label: "Recent" },
  { key: "progress", label: "Progress" },
];

export function TracksView({ tracks }: { tracks: TrackSummary[] }) {
  const reduceMotion = useMotionPreferences();
  const [importOpen, setImportOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<FilterKey>("active");
  const [sort, setSort] = React.useState<SortKey>("next");

  // The mobile tab bar's "+" and the hub's quick-action pill both land here.
  useCreateShortcut(() => setImportOpen(true));
  usePendingCreate(() => setImportOpen(true));

  const remove = async (track: TrackCardData) => {
    if (
      !window.confirm(
        `Delete "${track.title}" and all its steps? This can't be undone.`
      )
    ) {
      return;
    }
    const result = await deleteTrack(track.id);
    if (result.error) {
      haptics.error();
      toast.error(result.error);
    } else {
      haptics.delete();
      toast.success("Track deleted");
    }
  };

  const visible = React.useMemo(() => {
    const filtered = tracks.filter((track) => {
      if (filter === "active") return track.status === "In progress";
      if (filter === "done") return track.status === "Completed";
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "next") {
        // Soonest first. An undated step is not chasing anything, so it
        // sinks to the bottom rather than to the top.
        const ad = a.nextDate ?? "9999-12-31";
        const bd = b.nextDate ?? "9999-12-31";
        if (ad !== bd) return ad < bd ? -1 : 1;
        return a.title.localeCompare(b.title);
      }
      if (sort === "progress") {
        const ap = a.total > 0 ? a.done / a.total : 0;
        const bp = b.total > 0 ? b.done / b.total : 0;
        if (ap !== bp) return bp - ap;
        return a.title.localeCompare(b.title);
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tracks, filter, sort]);

  if (tracks.length === 0) {
    return (
      <div className="relative pb-24 md:pb-28">
        <div className="flex flex-col items-center rounded-card glass-section border-dashed px-6 py-16 text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-white/6 border border-white/12">
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium text-foreground">No tracks yet</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Create a focused learning plan with Traqen&apos;s in-app AI planner,
            then follow your visual roadmap step by step.
          </p>
          <motion.button
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            type="button"
            onClick={() => setImportOpen(true)}
            className="mt-5 glass-btn-base glass-btn-primary h-10 gap-2 rounded-field px-4 text-sm"
          >
            <Plus className="h-4 w-4" /> Create a learning plan
          </motion.button>
        </div>

        <FabPlus label="Create learning plan" onClick={() => setImportOpen(true)} />
        <ImportTrackModal open={importOpen} onClose={() => setImportOpen(false)} />
      </div>
    );
  }

  return (
    <div className="relative pb-24 md:pb-28">
      {/* Filter and sort. The list has no table headers to click, so the
          controls sit above the grid. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          className="relative inline-flex rounded-field border border-border bg-muted/60 p-1"
          role="group"
          aria-label="Filter tracks"
        >
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                haptics.selection();
                setFilter(option.key);
              }}
              aria-pressed={filter === option.key}
              className={cn(
                "focus-ring rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors",
                filter === option.key
                  ? "border border-white/10 bg-white/[0.06] text-foreground"
                  : "border border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          className="relative inline-flex rounded-field border border-border bg-muted/60 p-1"
          role="group"
          aria-label="Sort tracks"
        >
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                haptics.selection();
                setSort(option.key);
              }}
              aria-pressed={sort === option.key}
              className={cn(
                "focus-ring rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors",
                sort === option.key
                  ? "border border-white/10 bg-white/[0.06] text-foreground"
                  : "border border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-card glass-section px-6 py-14 text-center text-sm text-muted-foreground/70">
          No tracks in this view.
        </p>
      ) : (
        <motion.div
          variants={reduceMotion ? undefined : listVariants}
          initial={reduceMotion ? false : "hidden"}
          animate={reduceMotion ? undefined : "visible"}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {visible.map((track, index) => (
            <TrackCard
              key={track.id}
              track={track}
              index={index}
              onDelete={(card) => void remove(card)}
            />
          ))}
        </motion.div>
      )}

      {/* Floating create button */}
      <FabPlus label="Create learning plan" onClick={() => setImportOpen(true)} />

      <ImportTrackModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
