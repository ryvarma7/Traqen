"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { CalendarDays, GraduationCap, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ImportTrackModal } from "@/components/tracks/import-track-modal";
import { deleteTrack } from "@/lib/actions/tracks";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const cardVariants: Variants = {
  hidden: { opacity: 0, filter: "blur(8px)", scale: 0.98 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

export type TrackSummary = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  status: "In progress" | "Completed" | "On hold";
  total: number;
  done: number;
  in_progress: number;
  created_at: string;
};

const STATUS_TONES: Record<TrackSummary["status"], string> = {
  "In progress": "bg-info-soft/80 text-info border-info-border/70",
  Completed: "bg-success-soft/80 text-success border-success-border/70",
  "On hold": "bg-white/5 text-muted-foreground border-white/15",
};

export function TracksView({ tracks }: { tracks: TrackSummary[] }) {
  const [importOpen, setImportOpen] = React.useState(false);

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}" and all its steps? This can't be undone.`)) return;
    const result = await deleteTrack(id);
    if (result.error) toast.error(result.error);
    else toast.success("Track deleted");
  };

  return (
    <div>
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center rounded-card glass-section border-dashed px-6 py-16 text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-white/6 border border-white/12">
            <GraduationCap className="h-5 w-5 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium text-foreground">No tracks yet</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Plan a course with any AI, paste its JSON plan here, and Traqen
            turns it into a visual roadmap you can check off step by step.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => setImportOpen(true)}
            className="mt-5 glass-btn-base glass-btn-primary h-10 gap-2 rounded-field px-4 text-sm"
          >
            <Plus className="h-4 w-4" /> Import a track
          </motion.button>
        </div>
      ) : (
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {tracks.map((track) => {
            const pct = track.total > 0 ? Math.round((track.done / track.total) * 100) : 0;
            return (
              <motion.div key={track.id} variants={cardVariants} className="h-full">
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.985 }} className="group relative h-full">
                  <Link
                    href={`/tracks/${track.id}`}
                    className="flex h-full flex-col rounded-card glass-tile glass-tile-hover p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-foreground">
                        {track.title}
                      </h2>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2.5 py-0.5 text-2xs font-medium",
                          STATUS_TONES[track.status]
                        )}
                      >
                        {track.status}
                      </span>
                    </div>

                    {track.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {track.description}
                      </p>
                    )}

                    <div className="mt-auto pt-4">
                      {/* Progress bar — white on black, animated fill */}
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                          {track.done}/{track.total} steps
                        </span>
                        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
                          className="h-full rounded-full bg-white"
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-mono text-2xs tabular-nums text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {formatShortDate(track.start_date)}
                        </span>
                        <button
                          type="button"
                          aria-label="Delete track"
                          onClick={(e) => {
                            e.preventDefault();
                            remove(track.id, track.title);
                          }}
                          className="rounded-field p-1.5 text-muted-foreground/0 transition-colors hover:bg-danger-soft/60 hover:text-danger group-hover:text-muted-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Floating import button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        type="button"
        aria-label="Import track"
        onClick={() => setImportOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full glass-btn-base glass-btn-primary shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      <ImportTrackModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}