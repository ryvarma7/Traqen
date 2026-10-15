"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink } from "lucide-react";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { LoadingBar } from "@/components/shared/loading-bar";
import { formatShortDate } from "@/lib/dates";
import { haptics } from "@/lib/haptics";
import type { TrackItem } from "@/lib/types";
import { cn, safeHttpUrl } from "@/lib/utils";

/** Touch target floor from the responsive rules — the visible checkbox is a
 *  22px circle but the button around it is a full 44×44. */
const TAP = "h-11 w-11";

/**
 * One task. The checkbox is a plain done / not-done toggle — the old
 * three-state cycle (To do → In progress → Done) is gone from the UI, but
 * rows already sitting at "In progress" still read as open, so no data is
 * orphaned by the change.
 */
export function TrackTaskRow({
  item,
  busy,
  onToggle,
  className,
}: {
  item: TrackItem;
  busy?: boolean;
  onToggle: (item: TrackItem) => void;
  className?: string;
}) {
  const done = item.status === "Done";
  const href = safeHttpUrl(item.resource_url);

  return (
    <div
      className={cn(
        "rounded-field glass-tile px-3 py-2.5 transition-opacity md:px-3.5 md:py-3",
        done && "opacity-60",
        className
      )}
    >
      <div className="flex items-start">
        <StatusCheckbox item={item} busy={busy} onToggle={onToggle} />

        <div className="min-w-0 flex-1 py-0.5">
          <span className="relative block">
            <p
              className={cn(
                "break-words text-[0.9375rem] leading-snug md:text-base",
                done ? "text-muted-foreground" : "font-medium text-foreground"
              )}
            >
              {item.title}
            </p>
            {/* The crossing-out line, drawn from the left rather than switched
                on with a CSS `line-through` — the stroke is the confirmation
                that the tap registered. */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute left-0 top-1/2 h-px w-full origin-left bg-foreground/60"
              initial={false}
              animate={{ scaleX: done ? 1 : 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </span>
          <ClampedDescription text={item.description} />
        </div>

        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => haptics.tapLight()}
            aria-label={`Open resource for ${item.title}`}
            className={cn(
              TAP,
              "focus-ring -mr-1.5 -mt-1 flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            )}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* pl-9 lines the meta up with the title: the 44px checkbox carries a
          -ml-2, so its right edge — and the text column — sit at 36px. */}
      {item.target_date && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-9">
          <CountdownPill date={item.target_date} />
          <span className="font-mono text-2xs tabular-nums text-muted-foreground">
            {formatShortDate(item.target_date)}
          </span>
        </div>
      )}
    </div>
  );
}

function StatusCheckbox({
  item,
  busy,
  onToggle,
}: {
  item: TrackItem;
  busy?: boolean;
  onToggle: (item: TrackItem) => void;
}) {
  const done = item.status === "Done";

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Mark "${item.title}" as not done` : `Mark "${item.title}" as done`}
      disabled={busy}
      onClick={() => onToggle(item)}
      className={cn(
        TAP,
        "focus-ring hover:bg-white/[0.06] -ml-2 -mt-1 flex shrink-0 items-center justify-center rounded-full disabled:opacity-70"
      )}
    >
      <motion.span
        aria-hidden
        className="flex h-[22px] w-[22px] items-center justify-center rounded-full border"
        animate={{
          backgroundColor: done ? "rgba(255,255,255,1)" : "rgba(0,0,0,0)",
          borderColor: done ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.35)",
          scale: done ? [1, 1.2, 1] : 1,
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {busy ? (
          <LoadingBar className="w-3.5" />
        ) : (
          <AnimatePresence>
            {done && (
              <motion.span
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        )}
      </motion.span>
    </motion.button>
  );
}

/** Two lines by default, tap to expand. The "more" affordance only appears
 *  when the text actually overflows, measured after layout. */
function ClampedDescription({ text }: { text: string | null }) {
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
    <button
      type="button"
      onClick={() => overflows && setExpanded((v) => !v)}
      aria-expanded={overflows ? expanded : undefined}
      className="focus-ring mt-0.5 block w-full rounded-field text-left"
    >
      <p
        ref={ref}
        className={cn(
          "whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground",
          !expanded && "line-clamp-2"
        )}
      >
        {text}
      </p>
      {overflows && (
        <span className="mt-0.5 inline-block text-xs font-medium text-foreground/70">
          {expanded ? "Show less" : "Show more"}
        </span>
      )}
    </button>
  );
}
