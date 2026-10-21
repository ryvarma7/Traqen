"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { blurIn, blurInTransition } from "@/lib/motion";

/** Calm, monochrome waiting state for the in-app AI plan generation request. */
export function PlanGenerationLoader({ topic }: { topic?: string }) {
  const reduceMotion = useMotionPreferences();
  const topicLabel = topic?.trim();

  return (
    <motion.div
      initial={reduceMotion ? false : blurIn.initial}
      animate={blurIn.animate}
      transition={reduceMotion ? { duration: 0 } : blurInTransition}
      className="flex min-h-[18rem] flex-col items-center justify-center rounded-card glass-section px-6 py-10 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden="true">
        <motion.span
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 9, ease: "linear", repeat: Infinity }}
          className="absolute inset-1 rounded-full border border-white/15 border-t-white/70"
        />
        <motion.span
          animate={reduceMotion ? undefined : { rotate: -360, scale: [1, 1.04, 1] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 4.5, ease: "easeInOut", repeat: Infinity }}
          className="absolute inset-5 rounded-full border border-white/20 border-b-white/60"
        />
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/8 text-foreground">
          <Sparkles className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-6 space-y-2">
        <p className="text-base font-semibold text-foreground">Building your learning plan</p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          {topicLabel
            ? `Designing a detailed path for ${topicLabel}, then writing the instructions for every step.`
            : "Designing a detailed path around your goals, then writing the instructions for every step."}
        </p>
        {/* A plan this size takes a couple of minutes: the course is designed
            in one pass, then every phase is written out in parallel. Saying so
            beats a spinner that looks stuck. */}
        <p className="text-2xs text-muted-foreground/60">This takes up to a couple of minutes.</p>
      </div>

      <div className="mt-6 flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25], scale: [0.9, 1, 0.9] }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 1.3, ease: "easeInOut", repeat: Infinity, delay: index * 0.16 }
            }
            className="h-1.5 w-1.5 rounded-full bg-white/70"
          />
        ))}
      </div>
      <span className="sr-only">This can take a couple of minutes.</span>
    </motion.div>
  );
}
