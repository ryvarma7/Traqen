import { cn } from "@/lib/utils";

/** Optional color dot on note tiles. */
export const NOTE_COLORS: Record<string, string> = {
  gray: "bg-stone-400",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-green-600",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
};

export function ColorDot({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        NOTE_COLORS[color] ?? NOTE_COLORS.gray,
        className
      )}
    />
  );
}
