import { cn } from "@/lib/utils";

/** Status pill colors per spec with subtle glass sheen: green = Offer/Accepted/Winner, red =
 *  Rejected/Not selected, blue/amber = in-progress, gray = Saved/Draft/Withdrawn. */
const STATUS_TONES: Record<string, string> = {
  Offer: "bg-success-soft/80 text-success border-success-border/70",
  Accepted: "bg-success-soft/80 text-success border-success-border/70",
  Winner: "bg-success-soft/80 text-success border-success-border/70",
  Rejected: "bg-danger-soft/80 text-danger border-danger-border/70",
  "Not selected": "bg-danger-soft/80 text-danger border-danger-border/70",
  Applied: "bg-info-soft/80 text-info border-info-border/70",
  Interview: "bg-warning-soft/80 text-warning border-warning-border/70",
  Shortlisted: "bg-warning-soft/80 text-warning border-warning-border/70",
  "In progress": "bg-info-soft/80 text-info border-info-border/70",
};

const DEFAULT_TONE = "bg-white/60 text-muted-foreground border-white/70";

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
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-2xs font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] backdrop-blur-sm",
        STATUS_TONES[status] ?? DEFAULT_TONE,
        className
      )}
    >
      {status}
    </span>
  );
}
