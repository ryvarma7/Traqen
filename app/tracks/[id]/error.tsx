"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { haptics } from "@/lib/haptics";

/** Route-level error boundary for a single track. Keeps the failure inside
 *  this route instead of blanking the whole app. */
export default function TrackDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    haptics.error();
    console.error("Track detail failed to load:", error);
  }, [error]);

  return (
    <div className="rounded-card glass-section flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-danger-border/70 bg-danger-soft/70">
        <TriangleAlert className="h-5 w-5 text-danger" />
      </span>

      <div>
        <p className="text-base font-semibold text-foreground">
          This track didn&apos;t load
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Something went wrong fetching the plan. Try again — your progress is
          safe.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-2xs text-muted-foreground/60">
            Ref {error.digest}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={reset}
          className="glass-btn-base glass-btn-primary h-10 rounded-field px-4 text-sm"
        >
          Try again
        </motion.button>
        <Link
          href="/tracks"
          onClick={() => haptics.tap()}
          className="glass-btn-base glass-btn-outline h-10 rounded-field px-4 text-sm"
        >
          All tracks
        </Link>
      </div>
    </div>
  );
}