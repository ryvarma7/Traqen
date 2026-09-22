/** Calendar aggregation — everything date-bearing across the app becomes a
 *  CalendarEvent; the month grid and agenda list render from this one shape.
 *  The `source` field is the plug point for a future Google Calendar sync. */

export type CalendarSource = "task" | "job" | "hackathon" | "track";

export type CalendarEvent = {
  id: string;
  /** Local date key, YYYY-MM-DD (all Traqen dates are date-only). */
  date: string;
  title: string;
  meta: string;
  source: CalendarSource;
  href: string;
  done: boolean;
};

/** Semantic dot colours per source — hue only where semantics matter. */
export const sourceDot: Record<CalendarSource, string> = {
  task: "#60A5FA",      // blue — tasks
  job: "#F59E0B",       // amber — job deadlines
  hackathon: "#34D399", // green — hackathons
  track: "#A3A3A3",     // gray — course steps
};

export const sourceLabel: Record<CalendarSource, string> = {
  task: "Task",
  job: "Job",
  hackathon: "Hackathon",
  track: "Course step",
};

function collect(
  events: CalendarEvent[],
  base: Omit<CalendarEvent, "date">,
  dates: (string | null)[]
) {
  const seen = new Set<string>();
  for (const d of dates) {
    if (!d || seen.has(d)) continue;
    seen.add(d);
    events.push({ ...base, date: d });
  }
}

/** Build the full event list from raw table rows (RLS already scoped). */
export function buildCalendarEvents(input: {
  tasks: { id: string; title: string; status: string; due_date: string | null }[];
  jobs: { id: string; company: string; status: string; deadline: string | null; follow_up_date: string | null }[];
  hackathons: { id: string; hackathon_name: string; status: string; start_date: string | null; deadline: string | null; follow_up_date: string | null }[];
  trackItems: { track_id: string; title: string; status: string; target_date: string | null }[];
  trackTitles: Map<string, string>;
}): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const t of input.tasks) {
    collect(events, {
      id: t.id,
      title: t.title,
      meta: "Task · due",
      source: "task",
      href: "/tasks",
      done: t.status === "Done",
    }, [t.due_date]);
  }

  for (const j of input.jobs) {
    collect(events, {
      id: j.id,
      title: j.company,
      meta: "Job · deadline",
      source: "job",
      href: "/applications",
      done: ["Rejected", "Withdrawn", "Offer"].includes(j.status),
    }, [j.deadline]);
    collect(events, {
      id: `${j.id}-fu`,
      title: j.company,
      meta: "Job · follow-up",
      source: "job",
      href: "/applications",
      done: false,
    }, [j.follow_up_date]);
  }

  for (const h of input.hackathons) {
    collect(events, {
      id: h.id,
      title: h.hackathon_name,
      meta: "Hackathon · deadline",
      source: "hackathon",
      href: "/applications",
      done: ["Not selected", "Withdrawn", "Winner"].includes(h.status),
    }, [h.deadline]);
    collect(events, {
      id: `${h.id}-start`,
      title: h.hackathon_name,
      meta: "Hackathon · event day",
      source: "hackathon",
      href: "/applications",
      done: false,
    }, [h.start_date]);
    collect(events, {
      id: `${h.id}-fu`,
      title: h.hackathon_name,
      meta: "Hackathon · follow-up",
      source: "hackathon",
      href: "/applications",
      done: false,
    }, [h.follow_up_date]);
  }

  for (const item of input.trackItems) {
    if (!item.target_date) continue;
    collect(events, {
      id: `${item.track_id}-${item.title}`,
      title: `${input.trackTitles.get(item.track_id) ?? "Track"} · ${item.title}`,
      meta: "Course step",
      source: "track",
      href: `/tracks/${item.track_id}`,
      done: item.status === "Done",
    }, [item.target_date]);
  }

  return events;
}

/** Group events by their YYYY-MM-DD date key. */
export function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  return map;
}

/** YYYY-MM-DD in local time (never toISOString — that shifts timezones). */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}