"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * One digit on the odometer. When the value changes the new digit rolls down
 * from above while the old one drops out underneath, so the column reads like
 * a physical wheel rather than a flickering number. The roll always travels
 * downward — a countdown and a stopwatch animate identically instead of
 * flipping direction on every wrap from 9 to 0.
 *
 * The entering and exiting digits are both mounted for the length of the
 * animation, so both are absolutely positioned over an invisible "0" sizer.
 * The sizer reserves exactly one digit of width (tabular numerals make every
 * digit the same width), which means the column can never be sized to the
 * wrong digit and clip its neighbour.
 *
 * With `prefers-reduced-motion` the two digits cross-fade in place.
 */
export function RollDigit({ value, className }: { value: string; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={cn("relative inline-block overflow-hidden", className)}>
      {/* The sizer must be exactly as wide as the widest value this column
          will ever show. Values are zero-padded, so "0".repeat(length)
          reserves two digits for hours/minutes/seconds and three once a
          stopwatch passes 99h — without it the column is one digit too
          narrow and clips the second character. */}
      <span aria-hidden className="invisible block">
        {"0".repeat(value.length)}
      </span>
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          className="absolute inset-0 block"
          initial={reduceMotion ? { opacity: 0 } : { y: "-110%" }}
          animate={reduceMotion ? { opacity: 1 } : { y: "0%" }}
          exit={reduceMotion ? { opacity: 0 } : { y: "110%" }}
          transition={
            reduceMotion
              ? { duration: 0.15 }
              : // Fast out of the gate, long soft settle — reads as weight.
                { type: "spring", stiffness: 520, damping: 34, mass: 0.6 }
          }
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}