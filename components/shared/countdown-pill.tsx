import { daysUntil, formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Deadline countdown pill with glass finish. Colors per spec:
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
    tone = "bg-danger-soft/80 text-danger border-danger-border/70";
  } else if (days === 0) {
    label = "Today";
    tone = "bg-danger-soft/80 text-danger border-danger-border/70";
  } else if (days <= 3) {
    label = `${days}d left`;
    tone = "bg-orange-500/10 text-orange-400 border-orange-500/30";
  } else if (days <= 7) {
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
