"use client";

import { motion } from "framer-motion";

/** Shared page entrance: fade + 8px slide, ~200ms (spec). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mx-auto w-full max-w-5xl px-4 pb-24 pt-20"
    >
      {children}
    </motion.main>
  );
}
