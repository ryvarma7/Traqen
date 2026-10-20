import { cn } from "@/lib/utils";

/** A compact, monochrome indeterminate progress bar for loading states. */
export function LoadingBar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("loading-bar h-1.5 w-32", className)}
    />
  );
}
