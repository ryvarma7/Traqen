"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink, PartyPopper } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { daysUntil, formatShortDate, relativeDays } from "@/lib/dates";
import { haptics } from "@/lib/haptics";
import type { TrackItem, TrackPhase } from "@/lib/types";
import { cn, safeHttpUrl } from "@/lib/utils";

/**
 * "What do I do next?" — the single most important thing on the page. The task
 * is derived (first open item), never stored, so it can never drift out of
 * date; marking it done moves the card to the next task automatically.
 */
export function UpNextCard({
  item,
  phase,
  totalItems,
  busy,
  onMarkDone,
}: {
  item: TrackItem | null;
  phase: TrackPhase | null;
  totalItems: number;
  busy?: boolean;
  onMarkDone: (item: TrackItem) => void;
}) {
  return (
    <section aria-labelledby="up-next-heading" className="accent-strip rounded-card glass-section p-4 md:p-5">
      <p
        id="up-next-heading"
        className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Up next
      </p>

      {item ? (
        <UpNextBody item={item} phase={phase} busy={busy} onMarkDone={onMarkDone} />
      ) : (
        <CompletionBody totalItems={totalItems} />
      )}
    </section>
  );
}

function UpNextBody({
  item,
  phase,
  busy,
  onMarkDone,
}: {
  item: TrackItem;
  phase: TrackPhase | null;
  busy?: boolean;
  onMarkDone: (item: TrackItem) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);
  const descRef = React.useRef<HTMLParagraphElement>(null);
  const href = safeHttpUrl(item.resource_url);
  const days = item.target_date ? daysUntil(item.target_date) : null;

  React.useEffect(() => {
    setExpanded(false);
  }, [item.id]);

  React.useEffect(() => {
    const el = descRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [item.description, expanded]);

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {phase && (
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-2xs font-medium text-foreground/85">
            {phase.title}
          </span>
        )}
        {item.target_date && (
          <>
            <CountdownPill date={item.target_date} />
            <span className="font-mono text-2xs tabular-nums text-muted-foreground">
              {formatShortDate(item.target_date)} · {relativeDays(days ?? 0)}
            </span>
          </>
        )}
      </div>

      <h2 className="mt-2.5 break-words text-lg font-semibold leading-snug tracking-tight text-foreground md:text-xl">
        {item.title}
      </h2>

      {item.description && (
        <button
          type="button"
          onClick={() => overflows && setExpanded((v) => !v)}
          aria-expanded={overflows ? expanded : undefined}
          className="focus-ring mt-1 block w-full rounded-field text-left"
        >
          <p
            ref={descRef}
            className={cn(
              "whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]",
              !expanded && "line-clamp-2"
            )}
          >
            {item.description}
          </p>
          {overflows && (
            <span className="mt-1 inline-block text-xs font-medium text-foreground/70">
              {expanded ? "Show less" : "Show more"}
            </span>
          )}
        </button>
      )}

      <div className="mt-4 flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          disabled={busy}
          onClick={() => {
            haptics.impact();
            onMarkDone(item);
          }}
          className="glass-btn-base glass-btn-primary h-11 flex-1 gap-2 rounded-field px-4 text-sm font-semibold disabled:opacity-70"
        >
          {busy ? (
            <ThinkingOrb state="solving" size={20} theme="light" />
          ) : (
            <Check className="h-4 w-4" strokeWidth={3} />
          )}
          {busy ? "Saving…" : "Mark done"}
        </motion.button>

        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => haptics.tapLight()}
            aria-label={`Open resource for ${item.title}`}
            className="focus-ring glass-btn-base glass-btn-outline h-11 w-11 shrink-0 rounded-field"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    </>
  );
}

function CompletionBody({ totalItems }: { totalItems: number }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black">
        <PartyPopper className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground">Track complete</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          All {totalItems} {totalItems === 1 ? "step" : "steps"} done. Nice work.
        </p>
      </div>
    </div>
  );
}