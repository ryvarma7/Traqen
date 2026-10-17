import type { Transition, Variants } from "framer-motion";

/** Standard Traqen transition: blur-in (CLAUDE.md motion rules).
 *  opacity 0→1, blur 8px→0, scale 0.98→1, ~250ms ease-out; exits mirror. */
export const blurIn = {
  initial: { opacity: 0, filter: "blur(8px)", scale: 0.98 },
  // `none` releases the filter surface after the entrance. A resting blur(0px)
  // still creates a stacking/containing context on every card and long page.
  animate: { opacity: 1, filter: "none", scale: 1 },
  exit: { opacity: 0, filter: "blur(8px)", scale: 0.98 },
} as const;

export const blurInTransition = { duration: 0.25, ease: "easeOut" } as const;

/** Keep the first six items 50ms apart, then reveal the remainder together.
 *  A 200-row collection must not take ten seconds to become available. */
export function listItemTransition(index = 0): Transition {
  return {
    ...blurInTransition,
    delay: Math.min(Math.max(index, 0), 5) * 0.05,
    // Reorders should start immediately, not inherit the entrance delay.
    layout: blurInTransition,
  };
}

/** Pass custom={index} to children rather than an unbounded parent stagger. */
export const listVariants: Variants = {
  hidden: {},
  visible: {},
};

export const itemVariants: Variants = {
  hidden: blurIn.initial,
  visible: (index = 0) => ({
    ...blurIn.animate,
    transition: listItemTransition(index),
  }),
};
