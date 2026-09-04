import { daysUntil, formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Deadline countdown pill. Colors per spec:
 *  red = overdue/today, orange = 1–3 days, amber = 4–7, green/gray = 7+. */
export function CountdownPill({
  date,
  className,
}: {
  date: string;
  className?: string;
}) {
  const days = daysUntil(date);

  let label: string;
  let tone: string;
  if (days < 0) {
    label = `${Math.abs(days)}d overdue`;
    tone = "bg-danger-soft text-danger border-danger-border";
  } else if (days === 0) {
    label = "Today";
    tone = "bg-danger-soft text-danger border-danger-border";
  } else if (days <= 3) {
    label = `${days}d left`;
    tone = "bg-orange-50 text-orange-600 border-orange-200";
  } else if (days <= 7) {
    label = `${days}d left`;
    tone = "bg-warning-soft text-warning border-warning-border";
  } else {
    label = `${formatShortDate(date)}`;
    tone = "bg-muted text-muted-foreground border-border";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-2xs font-medium tabular-nums",
        tone,
        className
      )}
    >
      {label}
    </span>
  );
}
