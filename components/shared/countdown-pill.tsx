import { daysUntil, formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Past this many days out the pill stops counting down and shows the
 *  calendar date instead — counting down to a date three weeks away is noise. */
const DATE_ONLY_AFTER_DAYS = 7;

/** True when the pill renders the calendar date rather than a countdown, i.e.
 *  the date is more than a week out. Callers that print the date beside the
 *  pill use this so the same date is never shown twice, side by side. */
export function countdownShowsDate(date: string): boolean {
  return daysUntil(date) > DATE_ONLY_AFTER_DAYS;
}

/** Deadline countdown pill with glass finish. Colors per spec:
 *  red = overdue/today, orange = 1–3 days, amber = 4–7, green/gray = 7+. */
export function CountdownPill({
  date,
  role = "deadline",
  className,
}: {
  date: string;
  /** A passed *deadline* is "overdue"; a passed *follow-up* is "late" —
   *  you meant to check in and didn't. Same tone, different word. */
  role?: "deadline" | "follow_up" | "due";
  className?: string;
}) {
  const days = daysUntil(date);

  let label: string;
  let tone: string;
  if (days < 0) {
    label =
      role === "follow_up"
        ? `${Math.abs(days)}d late`
        : `${Math.abs(days)}d overdue`;
    tone = "bg-danger-soft/80 text-danger border-danger-border/70";
  } else if (days === 0) {
    label = "Today";
    tone = "bg-danger-soft/80 text-danger border-danger-border/70";
  } else if (days <= 3) {
    label = `${days}d left`;
    tone = "bg-orange-500/10 text-orange-400 border-orange-500/30";
  } else if (days <= DATE_ONLY_AFTER_DAYS) {
    label = `${days}d left`;
    tone = "bg-warning-soft/80 text-warning border-warning-border/70";
  } else {
    label = `${formatShortDate(date)}`;
    tone = "bg-white/5 text-muted-foreground border-white/15";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-2xs font-medium tabular-nums backdrop-blur-sm",
        tone,
        className
      )}
    >
      {label}
    </span>
  );
}
