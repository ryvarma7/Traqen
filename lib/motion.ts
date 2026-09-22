import type { Variants } from "framer-motion";

/** Standard Traqen transition: blur-in (CLAUDE.md motion rules).
 *  opacity 0→1, blur 8px→0, scale 0.98→1, ~250ms ease-out; exits mirror. */
export const blurIn = {
  initial: { opacity: 0, filter: "blur(8px)", scale: 0.98 },
  animate: { opacity: 1, filter: "blur(0px)", scale: 1 },
  exit: { opacity: 0, filter: "blur(8px)", scale: 0.98 },
} as const;

export const blurInTransition = { duration: 0.25, ease: "easeOut" } as const;

/** Staggered list mount: container + children blur-in 40–60ms apart.
 *  Put `layout` on the children so add/edit/delete morphs neighbours. */
export const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, filter: "blur(8px)", scale: 0.98 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};