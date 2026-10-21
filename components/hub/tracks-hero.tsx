"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { LoadingBar } from "@/components/shared/loading-bar";
import { setTrackItemStatus } from "@/lib/actions/tracks";
import { haptics } from "@/lib/haptics";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { cn } from "@/lib/utils";

export type HubTrackStep = {
  id: string;
  track_id: string;
  title: string;
  status: string;
  target_date: string | null;
  position: number;
};

export type HubTrackFocus = {
  trackId: string;
  trackTitle: string;
  phaseTitle: string | null;
  item: HubTrackStep;
};

/**
 * The hub's headline: the one thing the learner should do next.
 *
 * One track, one step, and a button to finish it. Everything else on the
 * dashboard is a briefing; this is the one control that acts.
 *
 * The step is the same one the track's own page calls "up next", because
 * both come from the same derivation — the dashboard can never tell the
 * learner to do something different from the plan they are looking at.
 */
export function TracksHero({ focus }: { focus: HubTrackFocus | null }) {
  const reduceMotion = useMotionPreferences();
  const [item, setItem] = React.useState(focus?.item ?? null);
  const [busy, setBusy] = React.useState(false);

  // A new focus arrives when the server re-renders the page.
  React.useEffect(() => {
    setItem(focus?.item ?? null);
  }, [focus]);

  if (!focus || !item) return null;

  const done = item.status === "Done";

  const markDone = async () => {
    if (busy) return;
    const next = done ? "To do" : "Done";
    setBusy(true);

    const result = await setTrackItemStatus(item.id, next);
    setBusy(false);

    if (result.error) {
      haptics.error();
      toast.error(result.error);
      return;
    }

    haptics.success();
    toast("Step completed", {
      description: item.title,
      action: {
        label: "Undo",
        onClick: () => {
          setItem((current) =>
            current ? { ...current, status: "To do" } : current
          );
          void setTrackItemStatus(item.id, "To do");
        },
      },
      duration: 6000,
    });

    setItem((current) => (current ? { ...current, status: next } : current));
  };

  return (
    <section className="panel mb-4 overflow-hidden" aria-label="Continue learning">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-5">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Continue learning
        </p>
        <Link
          href={`/tracks/${focus.trackId}`}
          className="text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Open track
        </Link>
      </div>

      <div className="px-4 pb-4 pt-2 md:px-5 md:pb-5">
        <Link href={`/tracks/${focus.trackId}`} className="group block">
          <p className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground/90">
            {focus.trackTitle}
          </p>
          {focus.phaseTitle && (
            <p className="mt-0.5 text-2xs text-muted-foreground/70">
              {focus.phaseTitle}
            </p>
          )}
          <p className="mt-2 break-words text-lg font-semibold tracking-tight text-foreground md:text-xl">
            {item.title}
          </p>
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.target_date && <CountdownPill date={item.target_date} />}
          <motion.button
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            type="button"
            onClick={() => void markDone()}
            disabled={busy}
            className={cn(
              "glass-btn-base flex h-10 items-center gap-2 rounded-field px-4 text-sm disabled:opacity-60",
              done
                ? "glass-btn-ghost text-muted-foreground"
                : "glass-btn-primary"
            )}
          >
            {busy ? (
              <LoadingBar className="h-1 w-8" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={3} />
            )}
            {busy ? "Saving…" : done ? "Mark not done" : "Mark done"}
          </motion.button>

          <Link
            href={`/tracks/${focus.trackId}`}
            className="glass-btn-base glass-btn-ghost flex h-10 items-center gap-1.5 rounded-field px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Plan
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
