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

function formatCalendarDate(key: string, options: Intl.DateTimeFormatOptions) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

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
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const move = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const selected = selectedKey ? eventsByDate[selectedKey] ?? [] : [];
  const selectedLabel = selectedKey
    ? formatCalendarDate(selectedKey, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "No day selected";

  return (
    <div className="glass-section rounded-card p-3 sm:p-4 md:p-5 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-2 sm:mb-5">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg md:text-xl">
          {monthLabel}
        </h2>
        <div className="flex items-center gap-1.5">
          <motion.button
            type="button"
            onClick={() => move(-1)}
            whileTap={{ scale: 0.97 }}
            aria-label="Previous month"
            className="glass-btn-base glass-btn-outline flex h-8 w-8 items-center justify-center rounded-field sm:h-9 sm:w-9"
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
            className="glass-btn-base glass-btn-outline h-8 rounded-field px-2.5 text-[11px] font-medium text-foreground sm:h-9 sm:px-3 sm:text-xs"
          >
            Today
          </motion.button>
          <motion.button
            type="button"
            onClick={() => move(1)}
            whileTap={{ scale: 0.97 }}
            aria-label="Next month"
            className="glass-btn-base glass-btn-outline flex h-8 w-8 items-center justify-center rounded-field sm:h-9 sm:w-9"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between rounded-field border border-border bg-black/20 px-3 py-2 md:hidden">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Selected
        </span>
        <span className="text-xs font-medium text-foreground">{selectedLabel}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_260px] md:gap-5 lg:gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="grid grid-cols-7 border-b border-border pb-2">
            {WEEKDAYS.map((d) => (
              <span
                key={d}
                className="text-center text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-2xs"
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
                  aria-pressed={isSelected}
                  onClick={() => setSelectedKey(cell.key)}
                  className={cn(
                    "relative flex min-h-[52px] flex-col items-center border-b border-r border-border py-1.5 transition-colors last:border-r-0 sm:min-h-[60px] md:min-h-[76px] md:py-2",
                    cell.inMonth ? "" : "opacity-35",
                    isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] tabular-nums sm:h-6 sm:w-6 sm:text-xs",
                      isToday ? "bg-white font-semibold text-black" : "text-foreground"
                    )}
                  >
                    {cell.day}
                  </span>
                  {events.length > 0 && (
                    <span className="mt-1 flex items-center gap-1">
                      {events.slice(0, MAX_DOTS).map((e) => (
                        <span
                          key={e.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: sourceDot[e.source] }}
                        />
                      ))}
                      {events.length > MAX_DOTS && (
                        <span className="text-[9px] leading-none text-muted-foreground">
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

        <div className="hidden md:block">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedKey ?? "none"}
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <h3 className="mb-3 text-sm font-semibold text-foreground">{selectedLabel}</h3>
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

      <div className="mt-4 md:hidden">
        <div className="rounded-field border border-border bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              {selectedKey
                ? formatCalendarDate(selectedKey, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                : "No day selected"}
            </h3>
            {selectedKey && selected.length > 0 && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {selected.length} items
              </span>
            )}
          </div>
          {selected.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {selected.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </ul>
          )}
        </div>
      </div>

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