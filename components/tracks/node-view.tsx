"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cycleTrackItemStatus } from "@/lib/actions/tracks";
import { formatShortDate } from "@/lib/dates";
import type { TrackItem, TrackPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One phase column (256px) + one wire gap (40px) — the step size used by
 *  the edge scroll buttons. */
const SCROLL_STEP = 296;

/** N8n-style node graph: phase header nodes sit in one stretched row with
 *  dashed wires between them (items-stretch keeps every node the same
 *  height, so wires always hit the ports dead-center), item nodes stack
 *  below each header. Desktop scrolls horizontally with edge arrow buttons;
 *  mobile stacks as a vertical flow with down-arrow connectors. */
export function NodeView({
  phases,
  items,
  onItemChange,
}: {
  phases: TrackPhase[];
  items: TrackItem[];
  onItemChange: (id: string, next: TrackItem["status"]) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = React.useState(false);
  const [canRight, setCanRight] = React.useState(false);

  const updateArrows = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, phases.length, items.length]);

  const scrollByPhase = (dir: 1 | -1) =>
    scrollRef.current?.scrollBy({ left: dir * SCROLL_STEP, behavior: "smooth" });

  return (
    <div>
      {/* ── Desktop: horizontal node board ──────────────────────────────── */}
      <div className="relative hidden md:block">
        <div ref={scrollRef} className="overflow-x-auto pb-4 no-scrollbar">
          <div className="min-w-max pr-2">
            {/* Header row */}
            <div className="flex items-stretch">
              {phases.map((phase, pi) => {
                const phaseItems = items
                  .filter((i) => i.phase_id === phase.id)
                  .sort((a, b) => a.position - b.position);
                const done = phaseItems.filter((i) => i.status === "Done").length;
                const allDone = done === phaseItems.length;

                return (
                  <React.Fragment key={phase.id}>
                    {/* Phase header node */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: pi * 0.07, ease: "easeOut" }}
                      className="w-64 shrink-0"
                    >
                      <div
                        className={cn(
                          "relative h-full rounded-card border p-3.5",
                          allDone
                            ? "border-white/50 bg-white/8"
                            : "border-white/15 bg-surface"
                        )}
                        style={{ boxShadow: "0 4px 18px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)" }}
                      >
                        {/* In/out ports like a node editor */}
                        {pi > 0 && (
                          <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/40 bg-black" />
                        )}
                        {pi < phases.length - 1 && (
                          <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/40 bg-black" />
                        )}

                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-2xs font-semibold tabular-nums",
                              allDone
                                ? "border-white bg-white text-black"
                                : "border-white/30 text-foreground"
                            )}
                          >
                            {allDone ? <Check className="h-3 w-3" strokeWidth={3} /> : pi + 1}
                          </span>
                          <h3 className="min-w-0 flex-1 break-words text-xs font-semibold leading-snug text-foreground">
                            {phase.title}
                          </h3>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                            <motion.div
                              initial={false}
                              animate={{ width: `${phaseItems.length ? (done / phaseItems.length) * 100 : 0}%` }}
                              transition={{ duration: 0.4, ease: "easeOut" }}
                              className="h-full rounded-full bg-white"
                            />
                          </div>
                          <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                            {done}/{phaseItems.length}
                          </span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Wire between phase nodes — centered because the row
                        stretches every node to the same height. */}
                    {pi < phases.length - 1 && (
                      <div className="flex w-10 shrink-0 items-center justify-center">
                        <svg width="40" height="12" viewBox="0 0 40 12" className="text-white/40">
                          <line x1="2" y1="6" x2="32" y2="6" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1.5" />
                          <path d="M32 2 L39 6 L32 10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Item stacks aligned under their phase headers */}
            <div className="mt-3 flex">
              {phases.map((phase, pi) => {
                const phaseItems = items
                  .filter((i) => i.phase_id === phase.id)
                  .sort((a, b) => a.position - b.position);
                return (
                  <React.Fragment key={phase.id}>
                    <div className="relative w-64 shrink-0 space-y-2 pl-4">
                      <div aria-hidden className="absolute bottom-2 left-1 top-0 w-px bg-white/15" />
                      {phaseItems.map((item) => (
                        <NodeItem key={item.id} item={item} onChange={onItemChange} />
                      ))}
                    </div>
                    {pi < phases.length - 1 && <div className="w-10 shrink-0" />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Edge scroll buttons — shown only when there's more to see */}
        {canLeft && <ScrollEdge side="left" onClick={() => scrollByPhase(-1)} />}
        {canRight && <ScrollEdge side="right" onClick={() => scrollByPhase(1)} />}
      </div>

      {/* ── Mobile: vertical node flow ──────────────────────────────────── */}
      <div className="md:hidden">
        {phases.map((phase, pi) => {
          const phaseItems = items
            .filter((i) => i.phase_id === phase.id)
            .sort((a, b) => a.position - b.position);
          const done = phaseItems.filter((i) => i.status === "Done").length;
          const allDone = done === phaseItems.length;

          return (
            <React.Fragment key={phase.id}>
              <div>
                <div
                  className={cn(
                    "rounded-card border p-3.5",
                    allDone ? "border-white/50 bg-white/8" : "border-white/15 bg-surface"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-2xs font-semibold tabular-nums",
                        allDone ? "border-white bg-white text-black" : "border-white/30 text-foreground"
                      )}
                    >
                      {allDone ? <Check className="h-3 w-3" strokeWidth={3} /> : pi + 1}
                    </span>
                    <h3 className="min-w-0 flex-1 break-words text-xs font-semibold text-foreground">
                      {phase.title}
                    </h3>
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                      {done}/{phaseItems.length}
                    </span>
                  </div>
                </div>
                <div className="relative ml-3 space-y-2 border-l border-white/15 py-2 pl-4">
                  {phaseItems.map((item) => (
                    <NodeItem key={item.id} item={item} onChange={onItemChange} />
                  ))}
                </div>
              </div>

              {/* Down-arrow connector between phases */}
              {pi < phases.length - 1 && (
                <div aria-hidden className="flex justify-center py-1.5">
                  <svg width="12" height="26" viewBox="0 0 12 26" className="text-white/40">
                    <line x1="6" y1="0" x2="6" y2="18" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1.5" />
                    <path d="M2 16 L6 23 L10 16" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** Fade-out edge with a circular arrow button for scrolling the node board. */
function ScrollEdge({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const isLeft = side === "left";
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 z-10 flex w-24 items-center",
        isLeft
          ? "left-0 justify-start bg-gradient-to-r from-black via-black/75 to-transparent"
          : "right-0 justify-end bg-gradient-to-l from-black via-black/75 to-transparent"
      )}
    >
      <motion.button
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.06 }}
        type="button"
        onClick={onClick}
        aria-label={isLeft ? "Scroll phases left" : "Scroll phases right"}
        className={cn(
          "pointer-events-auto glass-btn-base glass-btn-outline h-10 w-10 rounded-full",
          isLeft ? "ml-1" : "mr-1"
        )}
      >
        {isLeft ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </motion.button>
    </div>
  );
}

function NodeItem({
  item,
  onChange,
}: {
  item: TrackItem;
  onChange: (id: string, next: TrackItem["status"]) => void;
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
    onChange(item.id, next);
  };

  const done = item.status === "Done";

  return (
    <div
      className={cn(
        "rounded-field border p-3 transition-colors",
        done ? "border-white/8 bg-white/[0.03] opacity-70" : "border-white/12 bg-surface"
      )}
    >
      <div className="flex items-start gap-2.5">
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={cycle}
          aria-label={`Mark "${item.title}" — currently ${item.status}`}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            done
              ? "border-white bg-white text-black"
              : item.status === "In progress"
                ? "border-info bg-info/15 text-info"
                : "border-white/30 text-transparent hover:border-white/60"
          )}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : done ? (
            <Check className="h-3 w-3" strokeWidth={3} />
          ) : item.status === "In progress" ? (
            <CircleDot className="h-3 w-3" />
          ) : null}
        </motion.button>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "break-words text-xs leading-snug",
              done ? "text-muted-foreground line-through decoration-white/30" : "text-foreground"
            )}
          >
            {item.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.target_date && (
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {formatShortDate(item.target_date)}
              </span>
            )}
            {item.resource_url && (
              <a
                href={item.resource_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-2xs font-medium text-foreground/70 hover:text-foreground"
              >
                <ExternalLink className="h-2.5 w-2.5" /> link
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}