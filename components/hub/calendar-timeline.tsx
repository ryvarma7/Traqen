"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight } from "lucide-react";
import { SegmentedTabs } from "@/components/hub/segmented-tabs";
import {
  dateKey,
  formatMonthLabel,
  monthCells,
  sourceDot,
  sourceLabel,
  type CalendarEvent,
} from "@/lib/calendar";
import { parseDateOnly } from "@/lib/dates";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
] as const;

type Tab = (typeof TABS)[number]["key"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Traqen stores date-only values, so a timeline hour is a presentational
 *  slice rather than real scheduling — 8am–8pm frames whatever exists. */
const HOUR_START = 8;
const HOUR_END = 20;

export function CalendarTimeline({
  eventsByDate,
}: {
  eventsByDate: Record<string, CalendarEvent[]>;
}) {
  const [tab, setTab] = React.useState<Tab>("today");
  const today = React.useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  // Picking a day in the month grid moves the day view to that date, so the
  // card never leaves the user on a grid they can't act on.
  const [focusKey, setFocusKey] = React.useState(todayKey);

  return (
    <section className="panel mb-4 px-4 pt-4 md:px-5" aria-label="Calendar">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-medium tracking-tight text-foreground">
          <CalendarDays className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          Calendar
        </h2>
        <div className="flex items-center gap-2">
          <SegmentedTabs tabs={TABS.map((t) => ({ ...t }))} value={tab} onChange={setTab} />
          <Link
            href="/calendar"
            aria-label="Full calendar"
            className="rounded-field p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </header>

      {tab === "today" && (
        <DayTimeline
          key={focusKey}
          dateKeyValue={focusKey}
          isToday={focusKey === todayKey}
          events={eventsByDate[focusKey] ?? []}
        />
      )}
      {tab === "week" && <WeekStrip start={today} eventsByDate={eventsByDate} />}
      {tab === "month" && (
        <MonthGrid
          cursor={today}
          eventsByDate={eventsByDate}
          onPick={(key) => {
            setFocusKey(key);
            setTab("today");
          }}
        />
      )}
    </section>
  );
}

/** Hour-framed day view. Traqen dates have no time component, so events are
 *  dealt into hour slots by their order within the day. */
function DayTimeline({
  dateKeyValue,
  isToday,
  events,
}: {
  dateKeyValue: string;
  isToday: boolean;
  events: CalendarEvent[];
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const heading = parseDateOnly(dateKeyValue).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (events.length === 0) {
    return <EmptyState label={`Nothing scheduled ${isToday ? "today" : `on ${heading}`}.`} />;
  }

  const visible = events.slice(0, hours.length);

  return (
    <div className="no-scrollbar overflow-x-auto pb-1">
      <div className="min-w-[520px]">
        {!isToday && (
          <p className="mb-2 text-2xs text-muted-foreground/70">{heading}</p>
        )}
        <div className="relative ml-14 border-l border-white/10">
          {hours.map((hour) => (
            <div
              key={hour}
              className="relative h-11 border-b border-white/[0.06] last:border-b-0"
            >
              <span className="absolute -left-14 top-1.5 w-11 text-right font-mono text-2xs tabular-nums text-muted-foreground/60">
                {hour > 12 ? `${hour - 12}pm` : `${hour}am`}
              </span>
            </div>
          ))}

          {/* Events overlay the grid, offset by their slot so several on one
              day stack instead of overlapping. */}
          <div className="absolute inset-y-0 left-0 right-0">
            {visible.map((event, i) => {
              const slot = i;
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, filter: "blur(8px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.04, ease: "easeOut" }}
                  className="absolute inset-x-1 px-1"
                  style={{ top: slot * 44 + 4 }}
                >
                  <Link
                    href={event.href}
                    className="event-tinted block px-2.5 py-1.5"
                    style={{ ["--event-color" as string]: sourceDot[event.source] }}
                  >
                    <p className="truncate text-2xs font-semibold text-foreground">
                      {event.title}
                    </p>
                    <p className="truncate text-2xs text-muted-foreground">
                      {sourceLabel[event.source]}
                    </p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Seven-day strip — one column per day, events listed under the date.
 *  The min-width lives on the INNER grid, never on the scroll container: an
 *  element that is both `min-w-*` and `overflow-x-auto` can't shrink to its
 *  parent, so it would widen the page instead of scrolling. */
function WeekStrip({
  start,
  eventsByDate,
}: {
  start: Date;
  eventsByDate: Record<string, CalendarEvent[]>;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: dateKey(d), day: d.getDate(), weekday: WEEKDAYS[d.getDay()] };
  });

  return (
    <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
      <div className="grid min-w-[540px] grid-cols-7 gap-1.5">
        {days.map(({ key, day, weekday }) => {
          const events = eventsByDate[key] ?? [];
          return (
            <div key={key} className="rounded-field bg-card-hover/60 p-2">
              <p className="text-2xs text-muted-foreground/70">{weekday}</p>
              <p className="font-mono text-sm tabular-nums text-foreground">{day}</p>
              <div className="mt-2 space-y-1">
                {events.length === 0 ? (
                  <span className="block h-1 w-6 rounded-full bg-white/10" aria-hidden />
                ) : (
                  events.slice(0, 3).map((e) => (
                    <Link
                      key={e.id}
                      href={e.href}
                      title={e.title}
                      className="block h-1.5 w-full rounded-full transition-opacity hover:opacity-80"
                      style={{ background: sourceDot[e.source] }}
                    >
                      <span className="sr-only">{e.title}</span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact month grid with a source dot per day. */
function MonthGrid({
  cursor,
  eventsByDate,
  onPick,
}: {
  cursor: Date;
  eventsByDate: Record<string, CalendarEvent[]>;
  onPick: (key: string) => void;
}) {
  const [month, setMonth] = React.useState(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const year = month.getFullYear();
  const index = month.getMonth();
  const cells = monthCells(year, index);
  const todayKey = dateKey(cursor);

  const shift = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            haptics.tap();
            shift(-1);
          }}
          aria-label="Previous month"
          className="rounded-field px-2 py-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-foreground">{formatMonthLabel(year, index)}</span>
        <button
          type="button"
          onClick={() => {
            haptics.tap();
            shift(1);
          }}
          aria-label="Next month"
          className="rounded-field px-2 py-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-center text-2xs text-muted-foreground/60">
            {d.slice(0, 1)}
          </span>
        ))}
        {cells.map((cell) => {
          const events = eventsByDate[cell.key] ?? [];
          const isToday = cell.key === todayKey;
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => {
                haptics.tap();
                onPick(cell.key);
              }}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-field text-2xs transition-colors",
                cell.inMonth ? "text-foreground/80" : "text-muted-foreground/25",
                isToday && "bg-white/10 text-foreground",
                !isToday && "hover:bg-white/5"
              )}
            >
              <span className={cn("font-mono tabular-nums", isToday && "font-semibold")}>
                {cell.day}
              </span>
              <span className="flex h-1 gap-0.5">
                {events.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    aria-hidden
                    className="h-1 w-1 rounded-full"
                    style={{ background: sourceDot[e.source] }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground/70">
      {label}
    </div>
  );
}