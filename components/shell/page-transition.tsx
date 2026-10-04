"use client";

import { motion } from "framer-motion";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { MobileTopBar } from "@/components/shell/mobile-top-bar";

/**
 * App shell + shared page entrance.
 *
 * Desktop (md and up): a fixed left rail plus a wide main column. Below md the
 * rail collapses into a compact top bar and a floating bottom tab bar.
 *
 * The blur-in entrance — opacity 0→1, blur 8px→0, scale 0.98→1, ~250ms —
 * stays on the <main> only, so the sidebar and tab bar are stable while the
 * page content swaps.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-scene mx-auto flex w-full max-w-[1600px]">
      <AppSidebar />

      <motion.main
        initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
        animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
        exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{ transformOrigin: "top center" }}
        className="min-w-0 flex-1 px-4 pb-tabbar pt-5 md:px-8 md:pb-16 md:pt-8"
      >
        <MobileTopBar />
        {children}
      </motion.main>

      <MobileTabBar />
    </div>
  );
}