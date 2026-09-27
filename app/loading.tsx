"use client";

import { motion } from "framer-motion";
import { ThinkingOrb } from "thinking-orbs";

export default function Loading() {
  return (
    <div className="app-scene flex min-h-screen items-center justify-center bg-black">
      <motion.div
        initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
        animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        aria-label="Loading"
        role="status"
      >
        <ThinkingOrb state="solving" size={64} theme="dark" />
      </motion.div>
    </div>
  );
}
