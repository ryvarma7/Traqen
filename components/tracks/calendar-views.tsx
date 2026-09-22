"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { TrackItemRow } from "@/components/tracks/track-item-row";
import type { TrackItem, TrackPhase } from "@/lib/types";

function toLocalDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function isoOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const dayName = (iso: string) =>
  toLocalDate(iso).toLocaleDateString(undefined, { weekday: "short" });
const dayLabel = (iso: string) =>
  toLocalDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const rangeLabel = (start: string, end: string) =>
  `${dayLabel(start)} – ${dayLabel(end)}`;

/** Day view: items grouped under each calendar date, ordered chronologically.
 *  Undated items land in a final "No date" bucket. */
export function DayView({
  items,
  onItemChange,
}: {
  items: TrackItem[];
  phases: TrackPhase[];
  onItemChange: (id: string, next: TrackItem["status"]) => void;
}) {
  const groups = React.useMemo(() => {
    const dated = items.filter((i) => i.target_date);
    const undated = items.filter((i) => !i.target_date);
    const byDate = new Map<string, TrackItem[]>();
    for (const item of dated) {
      const list = byDate.get(item.target_date!) ?? [];
      list.push(item);
      byDate.set(item.target_date!, list);
    }
    const sorted = Array.from(byDate.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
    return { sorted, undated };
  }, [items]);

  if (groups.sorted.length === 0 && groups.undated.length === 0) {
    return (
      <p className="rounded-card glass-section border-dashed px-6 py-10 text-center text-xs text-muted-foreground">
        Nothing here yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {groups.sorted.map(([date, list]) => (
        <DayGroup
          key={date}
          label={`${dayName(date)} · ${dayLabel(date)}`}
          items={list.sort((a, b) => a.position - b.position)}
          onItemChange={onItemChange}
        />
      ))}
      {groups.undated.length > 0 && (
        <DayGroup
          label="No date"
          items={groups.undated.sort((a, b) => a.position - b.position)}
          onItemChange={onItemChange}
        />
      )}
    </div>
  );
}

/** Week view: ISO weeks, each collapsible with a per-week progress bar. */
export function WeekView({
  items,
  onItemChange,
}: {
  items: TrackItem[];
  phases: TrackPhase[];
  onItemChange: (id: string, next: TrackItem["status"]) => void;
}) {
  const weeks = React.useMemo(() => {
    const dated = items.filter((i) => i.target_date);
    const undated = items.filter((i) => !i.target_date);
    const byWeek = new Map<string, { start: string; end: string; items: TrackItem[] }>();
    for (const item of dated) {
      const d = toLocalDate(item.target_date!);
      // Monday of that calendar week.
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const key = isoOf(monday);
      const entry = byWeek.get(key) ?? { start: key, end: isoOf(sunday), items: [] };
      entry.items.push(item);
      byWeek.set(key, entry);
    }
    return { sorted: Array.from(byWeek.values()).sort((a, b) => (a.start < b.start ? -1 : 1)), undated };
  }, [items]);

  if (weeks.sorted.length === 0 && weeks.undated.length === 0) {
    return (
      <p className="rounded-card glass-section border-dashed px-6 py-10 text-center text-xs text-muted-foreground">
        Nothing here yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {weeks.sorted.map((week, wi) => (
        <WeekGroup
          key={week.start}
          index={wi + 1}
          label={rangeLabel(week.start, week.end)}
          items={week.items.sort((a, b) => a.position - b.position)}
          onItemChange={onItemChange}
        />
      ))}
      {weeks.undated.length > 0 && (
        <WeekGroup
          index={weeks.sorted.length + 1}
          label="No date"
          items={weeks.undated.sort((a, b) => a.position - b.position)}
          onItemChange={onItemChange}
        />
      )}
    </div>
  );
}

function DayGroup({
  label,
  items,
  onItemChange,
}: {
  label: string;
  items: TrackItem[];
  onItemChange: (id: string, next: TrackItem["status"]) => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-mono text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
        <div className="h-px flex-1 bg-white/8" />
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <TrackItemRow
            key={item.id}
            item={item}
            onChange={(next) => onItemChange(item.id, next)}
            compact
          />
        ))}
      </div>
    </motion.section>
  );
}

function WeekGroup({
  index,
  label,
  items,
  onItemChange,
}: {
  index: number;
  label: string;
  items: TrackItem[];
  onItemChange: (id: string, next: TrackItem["status"]) => void;
}) {
  const done = items.filter((i) => i.status === "Done").length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-card glass-section p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
            W{index}
          </span>
          <h3 className="font-mono text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-20 overflow-hidden rounded-full bg-white/8 md:w-28">
            <motion.div
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full rounded-full bg-white"
            />
          </div>
          <span className="font-mono text-2xs tabular-nums text-muted-foreground">
            {done}/{items.length}
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <TrackItemRow
            key={item.id}
            item={item}
            onChange={(next) => onItemChange(item.id, next)}
            compact
          />
        ))}
      </div>
    </motion.section>
  );
}