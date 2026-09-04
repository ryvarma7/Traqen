import { cn } from "@/lib/utils";

/** Status pill colors per spec: green = Offer/Accepted/Winner, red =
 *  Rejected/Not selected, blue/amber = in-progress, gray = Saved/Draft/Withdrawn. */
const STATUS_TONES: Record<string, string> = {
  Offer: "bg-success-soft text-success border-success-border",
  Accepted: "bg-success-soft text-success border-success-border",
  Winner: "bg-success-soft text-success border-success-border",
  Rejected: "bg-danger-soft text-danger border-danger-border",
  "Not selected": "bg-danger-soft text-danger border-danger-border",
  Applied: "bg-info-soft text-info border-info-border",
  Interview: "bg-warning-soft text-warning border-warning-border",
  Shortlisted: "bg-warning-soft text-warning border-warning-border",
  "In progress": "bg-info-soft text-info border-info-border",
};

const DEFAULT_TONE = "bg-muted text-muted-foreground border-border";

export function StatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-2xs font-medium",
        STATUS_TONES[status] ?? DEFAULT_TONE,
        className
      )}
    >
      {status}
    </span>
  );
}
