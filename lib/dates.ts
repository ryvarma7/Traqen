/** Parses a date-only "YYYY-MM-DD" string as local midnight. Every Traqen date
 *  is date-only, so it must never be fed to `new Date(iso)` (that parses as UTC
 *  and shifts the day in negative-offset timezones) or to `toISOString()`
 *  (that shifts it in positive-offset ones). */
export function parseDateOnly(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00`);
}

/** Every date the server and browser both format goes through here with this
 *  locale, so an SSR'd string can never disagree with its client render. */
export const DATE_LOCALE = "en-US";

/** YYYY-MM-DD from a Date in the user's local timezone. */
export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Today as a local date-only key. */
export function todayISO(): string {
  return dateKey(new Date());
}

/** Shifts a date-only key by whole days, staying in local time (DST-safe:
 *  `setDate` on a local midnight re-normalises through any DST boundary). */
export function addDaysISO(dateISO: string, days: number): string {
  const d = parseDateOnly(dateISO);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Whole days from `fromISO` to `toISO` (positive when `toISO` is later).
 *  Rounded so a 23- or 25-hour DST day still counts as one day. */
export function diffDaysISO(fromISO: string, toISO: string): number {
  return Math.round(
    (parseDateOnly(toISO).getTime() - parseDateOnly(fromISO).getTime()) / 86_400_000
  );
}

/** True only for a real calendar date in "YYYY-MM-DD" form. A shape check
 *  alone is not enough: `new Date("2026-02-31T00:00:00")` silently rolls over
 *  into March, so the value is round-tripped through `dateKey` to confirm it
 *  survives unchanged. */
export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && dateKey(d) === value;
}

/** Human phrasing for a signed day offset: "today", "tomorrow", "in 5 days",
 *  "3 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export function daysUntil(dateISO: string): number {
  return diffDaysISO(todayISO(), dateISO);
}

/**
 * Short date label, e.g. "Nov 11".
 *
 * The locale is pinned rather than left as `undefined`: with `undefined` the
 * server and the browser each resolve their own default, so a user on an
 * en-GB browser got "11 Nov" while the server rendered "Nov 11" — a real
 * hydration mismatch, not just a cosmetic difference. Pinning keeps the SSR
 * and client output identical for every user.
 */
export function formatShortDate(dateISO: string): string {
  return parseDateOnly(dateISO).toLocaleDateString(DATE_LOCALE, {
    month: "short",
    day: "numeric",
  });
}

export function relativeTime(dateISO: string): string {
  const then = new Date(dateISO).getTime();
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(dateISO).toLocaleDateString(DATE_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
