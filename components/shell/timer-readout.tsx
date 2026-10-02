"use client";

import { RollDigit } from "@/components/shell/roll-digit";
import { splitTime } from "@/lib/timer-store";
import { cn } from "@/lib/utils";

/**
 * HH : MM : SS. Each unit rolls independently, so a second changing from 09
 * to 10 only spins the last digit while the minutes column sits still —
 * exactly how a real timer feels.
 *
 * Sized by the caller; `tone` switches the whole readout to the danger hue
 * once a countdown is inside its final minute, or green once it has elapsed.
 */
export function TimerReadout({
  ms,
  size = "md",
  tone = "default",
  className,
}: {
  ms: number;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "urgent" | "done";
  className?: string;
}) {
  const { h, m, s } = splitTime(ms);

  const sizes = {
    sm: "text-lg",
    md: "text-3xl md:text-4xl",
    lg: "text-5xl md:text-6xl",
  } as const;

  const tones = {
    default: "text-foreground",
    urgent: "text-danger",
    done: "text-success",
  } as const;

  return (
    <div
      className={cn(
        // items-center keeps every unit on one optical line; the digits carry
        // their own width, so only the gaps need tracking.
        "flex items-center justify-center gap-0.5 font-semibold tabular-nums",
        sizes[size],
        tones[tone],
        className
      )}
      role="timer"
    >
      <RollDigit value={h} />
      <span aria-hidden className="px-0.5 text-foreground/30">
        :
      </span>
      <RollDigit value={m} />
      <span aria-hidden className="px-0.5 text-foreground/30">
        :
      </span>
      <RollDigit value={s} />
    </div>
  );
}