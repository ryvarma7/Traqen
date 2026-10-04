"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { StatusPill } from "@/components/shared/status-pill";
import { daysUntil, formatShortDate } from "@/lib/dates";

/** One dated thing on a tracked entity. `role` drives the pill wording — a
 *  passed follow-up reads "late", a passed deadline reads "overdue". */
export type AttentionDate = {
  label: string;
  date: string;
  role: "deadline" | "follow_up" | "due";
};

/** One entity, with every date that matters for it. A company with both a
 *  deadline and a follow-up is a single card carrying two chips, not two
 *  near-identical cards. */
export type AttentionItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string | null;
  kind: string;
  status: string;
  dates: AttentionDate[];
  /** Nearest of `dates` — drives both the sort order and the urgency accent. */
  earliest: string;
};

/** Left accent colour for the nearest date, on the same ladder as the pills. */
function accentFor(date: string) {
  const days = daysUntil(date);
  if (days <= 0) return "#FF6B6B"; // overdue / today
  if (days <= 3) return "#FB923C";
  if (days <= 7) return "#FFD43B";
  return "rgba(255, 255, 255, 0.28)"; // 7d+ — present but not urgent
}

export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  const urgent = items.filter((i) => daysUntil(i.earliest) <= 0).length;

  return (
    <section aria-label="Needs attention" className="panel mb-4 px-4 py-3.5 md:px-5">
      <header className="mb-3 flex items-center gap-2">
        <span
          className="inline-block h-1.5 w-4 rounded-full"
          style={{ background: "linear-gradient(90deg, #FFFFFF, #8A8A8A)" }}
          aria-hidden
        />
        <h2 className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
          Needs attention
        </h2>
        <span className="ml-auto text-2xs text-muted-foreground/60">
          {urgent > 0 && (
            <span className="text-danger">{urgent} due now · </span>
          )}
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </header>

      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-x-visible md:px-0 xl:grid-cols-3">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
            className="w-64 shrink-0 md:w-auto md:shrink"
          >
            <Link
              href={item.href}
              className="flex h-full min-w-0 flex-col rounded-field border border-white/10 bg-card-hover px-3 py-2.5 transition-colors hover:border-white/20"
              style={{ borderLeft: `3px solid ${accentFor(item.earliest)}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-medium text-foreground">
                  {item.title}
                </p>
                <StatusPill status={item.status} className="shrink-0" />
              </div>

              <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                {item.kind}
                {item.subtitle ? ` · ${item.subtitle}` : ""}
              </p>

              {/* Every relevant date, each labelled so two chips on one card
                  read as two distinct obligations rather than a duplicate. */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {item.dates.map((d) => (
                  <span
                    key={`${d.role}-${d.date}`}
                    className="inline-flex items-baseline gap-1 whitespace-nowrap"
                  >
                    <span className="text-2xs text-muted-foreground/70">
                      {d.label}
                    </span>
                    <CountdownPill date={d.date} role={d.role} />
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground/50">
                      {formatShortDate(d.date)}
                    </span>
                  </span>
                ))}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}