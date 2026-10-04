"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

/**
 * Floating circular "+" add button — desktop only.
 *
 * Below md the mobile tab bar carries its own "+" (it dispatches on the
 * create bus, opening the same sheet), so this one steps aside rather than
 * stacking a second floating control on top of the bar.
 *
 * Rendered through createPortal(document.body) so it escapes the transform /
 * filter containing block of PageTransition's <motion.main> — inside that
 * wrapper, `position: fixed` would anchor to <main> instead of the viewport
 * and ride down the page as the list grows. Portal to body keeps it pinned
 * bottom-right in every layout, desktop and mobile.
 */
export function FabPlus({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <motion.button
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
      type="button"
      aria-label={label}
      onClick={onClick}
      className="glass-btn-base glass-btn-primary fixed bottom-6 right-6 z-30 hidden h-14 w-14 items-center justify-center rounded-full shadow-lg md:flex lg:right-8"
    >
      <Plus className="h-6 w-6" />
    </motion.button>,
    document.body
  );
}