import { cn } from "@/lib/utils";

/** Priority pills per spec: red = High, amber = Medium, gray = Low. */
const PRIORITY_TONES: Record<string, string> = {
  High: "bg-danger-soft text-danger border-danger-border",
  Medium: "bg-warning-soft text-warning border-warning-border",
  Low: "bg-muted text-muted-foreground border-border",
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
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-2xs font-medium",
        PRIORITY_TONES[priority] ?? PRIORITY_TONES.Medium,
        className
      )}
    >
      {priority}
    </span>
  );
}
