"use client";

import * as React from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { haptics } from "@/lib/haptics";

/** Generic route fallback. Database/provider details stay server-side. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    haptics.error();
    console.error("Page failed to load", error.digest ?? "unknown");
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-danger-border/70 bg-danger-soft/70">
        <TriangleAlert className="h-5 w-5 text-danger" />
      </span>
      <div>
        <h1 className="text-base font-semibold text-foreground">This page didn&apos;t load</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Something went wrong while loading your data. Try again — nothing was deleted.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-2xs text-muted-foreground/60">Ref {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="glass-btn-base glass-btn-primary h-10 rounded-field px-4 text-sm"
        >
          Try again
        </button>
        <Link href="/" className="glass-btn-base glass-btn-outline h-10 rounded-field px-4 text-sm">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
