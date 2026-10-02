import { addDaysISO, daysUntil, diffDaysISO } from "@/lib/dates";
import type { TrackItem, TrackPhase } from "@/lib/types";

/**
 * Pure derivations over a track's phases + items. Everything here is a
 * recomputation from the rows the page already fetched — no extra queries, no
 * stored state, so the same helpers are safe to call on every optimistic
 * update.
 *
 * "Current" is always derived: the first phase that still has an open item.
 * Nothing in the schema tracks it, so it can never drift out of sync.
 */

export type PhaseState = "done" | "current" | "upcoming";

export type PhaseProgress = {
  phase: TrackPhase;
  /** 0-based position for the "Phase N" label. */
  index: number;
  /** Items in this phase, ordered by their stored position. */
  items: TrackItem[];
  done: number;
  total: number;
  state: PhaseState;
  /** Earliest/latest dated item in the phase — the phase's date range. */
  range: { first: string; last: string } | null;
};

/** Open = not done. Rows still sitting at "In progress" (a state the UI no
 *  longer offers, kept for data compatibility) count as open. */
function isOpen(item: TrackItem) {
  return item.status !== "Done";
}

/** Within a phase, the earliest deadline wins; undated steps sort last and
 *  fall back to their stored order. */
function byDueThenPosition(a: TrackItem, b: TrackItem) {
  const ad = a.target_date ?? "9999-12-31";
  const bd = b.target_date ?? "9999-12-31";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.position - b.position;
}

/** Joins phases to their items and derives each phase's state and date range. */
export function buildPhaseProgress(
  phases: TrackPhase[],
  items: TrackItem[]
): PhaseProgress[] {
  const byPhase = new Map<string, TrackItem[]>();
  for (const item of items) {
    const list = byPhase.get(item.phase_id);
    if (list) list.push(item);
    else byPhase.set(item.phase_id, [item]);
  }

  // A phase is "current" while it is the first one with work still open.
  const currentId = phases.find((phase) =>
    (byPhase.get(phase.id) ?? []).some(isOpen)
  )?.id;

  return phases.map((phase, index) => {
    const phaseItems = (byPhase.get(phase.id) ?? []).sort((a, b) => a.position - b.position);
    const total = phaseItems.length;
    const done = phaseItems.filter((i) => i.status === "Done").length;
    const dated = phaseItems
      .map((i) => i.target_date)
      .filter((d): d is string => Boolean(d))
      .sort();

    return {
      phase,
      index,
      items: phaseItems,
      done,
      total,
      state: (total > 0 && done === total
        ? "done"
        : phase.id === currentId
          ? "current"
          : "upcoming") as PhaseState,
      range: dated.length
        ? { first: dated[0], last: dated[dated.length - 1] }
        : null,
    };
  });
}

/** The task the user should do next: the first open item in phase order, and
 *  within that phase the earliest deadline. Null once everything is done. */
export function upNextItem(progress: PhaseProgress[]): TrackItem | null {
  for (const p of progress) {
    const open = p.items.filter(isOpen);
    if (open.length === 0) continue;
    return [...open].sort(byDueThenPosition)[0];
  }
  return null;
}

export type Pace = {
  /** Days past due on the worst overdue open task; 0 means on track. */
  behindDays: number;
  overdueCount: number;
};

/** Pace is measured purely off deadlines: an open task whose date has passed
 *  puts the track behind by however many days ago that was. */
export function paceOf(items: TrackItem[]): Pace {
  let behindDays = 0;
  let overdueCount = 0;

  for (const item of items) {
    if (!isOpen(item) || !item.target_date) continue;
    const overdue = -daysUntil(item.target_date);
    if (overdue > 0) {
      overdueCount += 1;
      if (overdue > behindDays) behindDays = overdue;
    }
  }

  return { behindDays, overdueCount };
}

export type NextDue = { item: TrackItem; days: number };

/** The next deadline the user is actually racing: the earliest open date. A
 *  task still in the future wins over an already-overdue one; if everything
 *  is overdue we surface the least-bad one rather than nothing at all. */
export function nextDueItem(items: TrackItem[]): NextDue | null {
  const dated = items
    .filter((i) => isOpen(i) && i.target_date)
    .sort(byDueThenPosition);
  if (dated.length === 0) return null;

  const upcoming = dated.find((i) => daysUntil(i.target_date!) >= 0);
  const item = upcoming ?? dated[dated.length - 1];
  return { item, days: daysUntil(item.target_date!) };
}

/**
 * "Reschedule remaining": anchor the first open dated task on `newStartISO`
 * and shift every other open dated task by the same number of days, which
 * preserves the relative spacing between tasks and across phase boundaries.
 * The client previews this; `rescheduleTrackItems` performs the same mapping
 * server-side.
 */
export function reschedulePreview(
  items: TrackItem[],
  newStartISO: string
): { count: number; delta: number } {
  const openDates = items
    .filter((i) => isOpen(i) && i.target_date)
    .map((i) => i.target_date!)
    .sort();

  if (openDates.length === 0) return { count: 0, delta: 0 };
  return {
    count: openDates.length,
    delta: diffDaysISO(openDates[0], newStartISO),
  };
}

/** itemId → new target_date for the shift `reschedulePreview` describes. */
export function applyReschedule(
  items: TrackItem[],
  newStartISO: string
): Map<string, string> {
  const { delta } = reschedulePreview(items, newStartISO);
  const next = new Map<string, string>();
  if (delta === 0) return next;

  for (const item of items) {
    if (!isOpen(item) || !item.target_date) continue;
    next.set(item.id, addDaysISO(item.target_date, delta));
  }
  return next;
}