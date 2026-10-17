"use client";

import * as React from "react";
import { MotionConfig } from "framer-motion";
import { blurInTransition } from "@/lib/motion";

const MotionPreferences = React.createContext(false);
const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

/** One reactive preference subscription for the app, including blur/delays
 *  which MotionConfig's transform-only reduction cannot disable by itself. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reducedMotion = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <MotionPreferences.Provider value={reducedMotion}>
      <MotionConfig reducedMotion="user" transition={reducedMotion ? { duration: 0, delay: 0 } : blurInTransition}>
        {children}
      </MotionConfig>
    </MotionPreferences.Provider>
  );
}

export function useMotionPreferences() {
  return React.useContext(MotionPreferences);
}
