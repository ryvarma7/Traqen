"use client";

import { motion } from "framer-motion";
import { TopBar } from "@/components/shell/top-bar";

/** Shared page entrance: blur-in — opacity 0→1, blur 8px→0, scale 0.98→1,
 *  ~250ms (CLAUDE.md motion rules). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.main
      initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{ transformOrigin: "top center" }}
      className="app-scene mx-auto w-full max-w-5xl px-4 pb-32 pt-5 md:px-6 md:pb-20 md:pt-7 lg:px-8"
 >
      <TopBar />
      {children}
    </motion.main>
  );
}
