"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { sourceDot, sourceLabel, type CalendarEvent } from "@/lib/calendar";
import { dateKey } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_DOTS = 3;

type MonthCell = {
  key: string;
  day: number;
  inMonth: boolean;
};

/** Six-week (42-cell) month grid starting on Sunday. */
function monthCells(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      key: dateKey(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    };
  });
}

export function CalendarView({
  eventsByDate,
}: {
  eventsByDate: Record<string, CalendarEvent[]>;
}) {
  const today = new Date();
  const todayKey = dateKey(today);
  const [cursor, setCursor] = React.useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedKey, setSelectedKey] = React.useState<string | null>(todayKey);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = monthCells(year, month);
  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const move = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const selected = selectedKey ? eventsByDate[selectedKey] ?? [] : [];

  // Agenda rows for the visible month (mobile list).
  const agenda = Object.entries(eventsByDate)
    .filter(([key]) => key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="glass-section rounded-card p-4 md:p-6">
      {/* Header: month nav */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-1.5">
          <motion.button
            type="button"
            onClick={() => move(-1)}
            whileTap={{ scale: 0.97 }}
            aria-label="Previous month"
            className="glass-btn-base glass-btn-outline flex h-9 w-9 items-center justify-center rounded-field"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </motion.button>
          <motion.button
            type="button"
            onClick={() => {
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedKey(todayKey);
            }}
            whileTap={{ scale: 0.97 }}
            className="glass-btn-base glass-btn-outline h-9 rounded-field px-3 text-xs font-medium text-foreground"
          >
            Today
          </motion.button>
          <motion.button
            type="button"
            onClick={() => move(1)}
            whileTap={{ scale: 0.97 }}
            aria-label="Next month"
            className="glass-btn-base glass-btn-outline flex h-9 w-9 items-center justify-center rounded-field"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.button>
        </div>
      </div>

      {/* Desktop: month grid + day panel. Mobile: agenda list below. */}
      <div className="hidden gap-6 md:grid md:grid-cols-[1fr_280px]">
        <div>
          <div className="grid grid-cols-7 border-b border-border pb-2">
            {WEEKDAYS.map((d) => (
              <span
                key={d}
                className="text-center text-2xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const events = eventsByDate[cell.key] ?? [];
              const isToday = cell.key === todayKey;
              const isSelected = cell.key === selectedKey;
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedKey(cell.key)}
                  className={cn(
                    "relative flex min-h-[76px] flex-col items-center border-b border-r border-border py-2 transition-colors last:border-r-0",
                    cell.inMonth ? "" : "opacity-35",
                    isSelected
                      ? "bg-white/[0.06]"
                      : "hover:bg-white/[0.03]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                      isToday
                        ? "bg-white font-semibold text-black"
                        : "text-foreground"
                    )}
                  >
                    {cell.day}
                  </span>
                  {events.length > 0 && (
                    <span className="mt-1.5 flex items-center gap-1">
                      {events.slice(0, MAX_DOTS).map((e) => (
                        <span
                          key={e.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: sourceDot[e.source] }}
                        />
                      ))}
                      {events.length > MAX_DOTS && (
                        <span className="text-2xs leading-none text-muted-foreground">
                          +{events.length - MAX_DOTS}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day panel */}
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedKey ?? "none"}
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {selectedKey
                  ? new Date(`${selectedKey}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })
                  : "No day selected"}
              </h3>
              {selected.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {selected.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile: agenda list grouped by day */}
      <div className="md:hidden">
        {agenda.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing scheduled this month.
          </p>
        ) : (
          <ul className="space-y-4">
            {agenda.map(([key, events]) => (
              <li key={key}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {key === todayKey && (
                    <span className="ml-2 rounded-full bg-white px-1.5 py-0.5 text-2xs font-semibold text-black">
                      Today
                    </span>
                  )}
                </p>
                <div className="space-y-2">
                  {events.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-4">
        {(["task", "job", "hackathon", "track"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: sourceDot[s] }} />
            {sourceLabel[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Link
        href={event.href}
        className={cn(
          "glass-tile flex items-center gap-2.5 rounded-field px-3 py-2.5 transition-all hover:shadow-lift",
          event.done && "opacity-50"
        )}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: sourceDot[event.source] }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">
            {event.title}
          </span>
          <span className="block truncate text-2xs text-muted-foreground">
            {event.meta}
          </span>
        </span>
        {event.done && (
          <span className="shrink-0 text-2xs text-muted-foreground">Done</span>
        )}
      </Link>
    </motion.li>
  );
}