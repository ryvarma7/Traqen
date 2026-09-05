import { cn } from "@/lib/utils";

/** Priority pills per spec with glass finish: red = High, amber = Medium, gray = Low. */
const PRIORITY_TONES: Record<string, string> = {
  High: "bg-danger-soft/80 text-danger border-danger-border/70",
  Medium: "bg-warning-soft/80 text-warning border-warning-border/70",
  Low: "bg-white/60 text-muted-foreground border-white/70",
};

export function PriorityPill({
  priority,
  className,
}: {
  priority: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-2xs font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] backdrop-blur-sm",
        PRIORITY_TONES[priority] ?? PRIORITY_TONES.Medium,
        className
      )}
    >
      {priority}
    </span>
  );
}
