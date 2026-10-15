"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoadingBar } from "@/components/shared/loading-bar";

/** Full-screen loading overlay shown right after Google sign-in. */
export function PostLoginLoader({
  initiallyActive,
}: {
  initiallyActive: boolean;
}) {
  const [active, setActive] = useState(initiallyActive);

  useEffect(() => {
    if (!active) return;
    // The callback already waits for the server-rendered home page. Do not add
    // an artificial two-second delay before the user can interact with it.
    const release = window.requestAnimationFrame(() => setActive(false));
    return () => window.cancelAnimationFrame(release);
  }, [active]);

  useEffect(() => {
    if (active) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("justSignedIn")) {
      url.searchParams.delete("justSignedIn");
      window.history.replaceState(window.history.state, "", url);
    }
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={false}
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
          exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          aria-label="Loading"
          role="status"
        >
          <LoadingBar />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
