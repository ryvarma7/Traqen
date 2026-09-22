"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, CircleDot, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { cycleTrackItemStatus } from "@/lib/actions/tracks";
import type { TrackItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Animated status checkbox that cycles To do → In progress → Done. */
export function StatusToggle({
  item,
  onChange,
}: {
  item: TrackItem;
  onChange?: (next: TrackItem["status"]) => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const cycle = async () => {
    if (busy) return;
    setBusy(true);
    const next: TrackItem["status"] =
      item.status === "To do" ? "In progress" : item.status === "In progress" ? "Done" : "To do";
    const result = await cycleTrackItemStatus(item.id, item.status);
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onChange?.(next);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      type="button"
      onClick={cycle}
      aria-label={`Mark "${item.title}" — currently ${item.status}`}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
        item.status === "Done"
          ? "border-white bg-white text-black"
          : item.status === "In progress"
            ? "border-info bg-info/15 text-info"
            : "border-white/30 bg-transparent text-transparent hover:border-white/60"
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : item.status === "Done" ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      ) : item.status === "In progress" ? (
        <CircleDot className="h-3.5 w-3.5" />
      ) : null}
    </motion.button>
  );
}

/** Full item row: toggle + content + resource link + countdown. */
export function TrackItemRow({
  item,
  onChange,
  compact,
}: {
  item: TrackItem;
  onChange?: (next: TrackItem["status"]) => void;
  compact?: boolean;
}) {
  const done = item.status === "Done";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-field glass-tile p-3.5",
        done && "opacity-60"
      )}
    >
      <StatusToggle item={item} onChange={onChange} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "break-words text-sm leading-snug",
            done ? "text-muted-foreground line-through decoration-white/30" : "text-foreground font-medium"
          )}
        >
          {item.title}
        </p>
        {item.description && !compact && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {item.status === "In progress" && (
            <span className="inline-flex items-center rounded-full border border-info-border/70 bg-info-soft/80 px-2 py-0.5 text-2xs font-medium text-info">
              In progress
            </span>
          )}
          {item.target_date && <CountdownPill date={item.target_date} />}
          {item.resource_url && (
            <a
              href={item.resource_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-2xs font-medium text-foreground/80 transition-colors hover:border-white/30 hover:text-foreground"
            >
              Resource <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}