"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { CountdownPill } from "@/components/shared/countdown-pill";
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
          <p
            className={cn(
              "break-words text-[0.9375rem] leading-snug md:text-base",
              done
                ? "text-muted-foreground line-through decoration-white/30"
                : "font-medium text-foreground"
            )}
          >
            {item.title}
          </p>
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
        "focus-ring -ml-2 -mt-1 flex shrink-0 items-center justify-center rounded-full disabled:opacity-70"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-[22px] w-[22px] items-center justify-center rounded-full border transition-colors",
          done
            ? "border-white bg-white text-black"
            : "border-white/35 text-transparent hover:border-white/70"
        )}
      >
        {busy ? (
          <ThinkingOrb state="solving" size={20} theme="dark" />
        ) : done ? (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        ) : null}
      </span>
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