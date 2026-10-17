"use client";

import { motion } from "framer-motion";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { MobileTopBar } from "@/components/shell/mobile-top-bar";
import { NavLoader } from "@/components/shell/nav-loader";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { blurIn, blurInTransition } from "@/lib/motion";

/**
 * App shell + shared page entrance.
 *
 * Desktop (md and up): a fixed left rail plus a wide main column. Below md the
 * rail collapses into a compact top bar and a floating bottom tab bar.
 *
 * The blur-in entrance — opacity 0→1, blur 8px→0, scale 0.98→1, ~250ms —
 * stays on the <main> only, so the sidebar and tab bar are stable while the
 * page content swaps.
 *
 * <main> is the positioning context for NavLoader, which blurs this column in
 * place while a navigation resolves rather than replacing it.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reducedMotion = useMotionPreferences();
  return (
    <div className="app-scene mx-auto flex w-full max-w-[1600px]">
      <AppSidebar />

      <motion.main
        initial={reducedMotion ? false : blurIn.initial}
        animate={blurIn.animate}
        exit={reducedMotion ? undefined : blurIn.exit}
        transition={reducedMotion ? { duration: 0 } : blurInTransition}
        style={{ transformOrigin: "top center" }}
        className="relative min-w-0 flex-1 px-4 pb-tabbar pt-5 md:px-8 md:pb-16 md:pt-8"
      >
        <MobileTopBar />
        {children}
        <NavLoader />
      </motion.main>

      <MobileTabBar />
    </div>
  );
}
