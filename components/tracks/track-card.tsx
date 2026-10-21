"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CalendarDays, Trash2 } from "lucide-react";
import Link from "next/link";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { formatShortDate } from "@/lib/dates";
import { haptics } from "@/lib/haptics";
import { blurIn, itemVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type TrackCardData = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: "In progress" | "Completed" | "On hold";
  total: number;
  done: number;
  /** The step the learner should do next in this track, and its date. */
  nextTitle: string | null;
  nextDate: string | null;
};

const STATUS_TONES: Record<TrackCardData["status"], string> = {
  "In progress": "bg-info-soft/80 text-info border-info-border/70",
  Completed: "bg-success-soft/80 text-success border-success-border/70",
  "On hold": "bg-white/5 text-muted-foreground border-white/15",
};

/**
 * One track in the list.
 *
 * The card says three things: what the course is, how far along it is, and
 * what to do next. The last one is why the next step is on the card at all —
 * a progress bar tells you where you are, but the step is what you are
 * actually here to do.
 */
export function TrackCard({
  track,
  index,
  onDelete,
}: {
  track: TrackCardData;
  index: number;
  onDelete: (track: TrackCardData) => void;
}) {
  const reduceMotion = useMotionPreferences();
  const pct = track.total > 0 ? Math.round((track.done / track.total) * 100) : 0;

  return (
    <motion.div
      custom={index}
      variants={reduceMotion ? undefined : itemVariants}
      initial={reduceMotion ? false : undefined}
      animate={reduceMotion ? blurIn.animate : undefined}
      transition={reduceMotion ? { duration: 0 } : undefined}
      layout={reduceMotion ? false : "position"}
      className="h-full"
    >
      <motion.div
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
        className="group relative h-full"
      >
        <Link
          href={`/tracks/${track.id}`}
          className="flex h-full flex-col rounded-card glass-tile glass-tile-hover p-5 pb-11"
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

          {track.nextTitle ? (
            <div className="mt-3 flex items-start gap-2 rounded-field border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
              <span className="mt-0.5 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
                Next
              </span>
              <span className="min-w-0 flex-1 text-xs leading-snug text-foreground/85">
                {track.nextTitle}
              </span>
              {track.nextDate && (
                <CountdownPill date={track.nextDate} className="shrink-0" />
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground/70">
              {track.total > 0
                ? "Every step in this track is done."
                : "No steps in this track yet."}
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
                initial={reduceMotion ? false : { scaleX: 0 }}
                animate={{ scaleX: pct / 100 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.7, ease: "easeOut", delay: 0.15 }
                }
                className="h-full w-full origin-left rounded-full bg-white"
              />
            </div>
          </div>
        </Link>

        <span className="absolute bottom-3 left-5 flex items-center gap-1.5 font-mono text-2xs tabular-nums text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          {formatShortDate(track.start_date)}
          {track.end_date && ` – ${formatShortDate(track.end_date)}`}
        </span>

        {/* The delete button sits beside the card rather than inside its
            link. It used to be inside, which meant an invisible button
            nested in an anchor — and on a touch screen, where there is no
            hover to reveal it, a tap on nothing could delete a track. */}
        <button
          type="button"
          aria-label={`Delete track ${track.title}`}
          onClick={() => {
            haptics.tap();
            onDelete(track);
          }}
          className="focus-ring absolute bottom-2 right-3 rounded-field p-1.5 text-muted-foreground/50 transition-colors hover:bg-danger-soft/60 hover:text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </motion.div>
  );
}
