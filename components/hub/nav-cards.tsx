"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Briefcase, ClipboardList, GraduationCap, StickyNote } from "lucide-react";
import Link from "next/link";

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const card: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export type HubCard = {
  href: string;
  title: string;
  description: string;
  count: number;
  countLabel: string;
  icon: "briefcase" | "tasks" | "notes" | "tracks";
};

const icons = {
  briefcase: Briefcase,
  tasks: ClipboardList,
  notes: StickyNote,
  tracks: GraduationCap,
};

// Each section card gets a subtle white tint for the icon zone
const iconStyles: Record<HubCard["icon"], { bg: string; iconColor: string; border: string }> = {
  briefcase: {
    bg:        "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
    border:    "rgba(255, 255, 255, 0.18)",
    iconColor: "#FFFFFF",
  },
  tasks: {
    bg:        "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
    border:    "rgba(255, 255, 255, 0.16)",
    iconColor: "#E5E5E5",
  },
  notes: {
    bg:        "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
    border:    "rgba(255, 255, 255, 0.18)",
    iconColor: "#FFFFFF",
  },
  tracks: {
    bg:        "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
    border:    "rgba(255, 255, 255, 0.18)",
    iconColor: "#FFFFFF",
  },
};

export function NavCards({ cards }: { cards: HubCard[] }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map(({ href, title, description, count, countLabel, icon }) => {
        const Icon = icons[icon];
        const style = iconStyles[icon];

        return (
          <motion.div key={href} variants={card}>
            <motion.div
              whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.98 }}
              className="h-full"
            >
              <Link
                href={href}
                className="group relative flex h-full min-h-44 flex-col justify-between overflow-hidden rounded-card glass-tile glass-tile-hover p-5"
              >
                {/* Subtle background glow on hover */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-card opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: "radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.05) 0%, transparent 60%)",
                  }}
                />

                <div className="flex items-start justify-between">
                  {/* Icon container */}
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-[10px] transition-transform duration-200 group-hover:scale-105"
                    style={{
                      background: style.bg,
                      border: `1px solid ${style.border}`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ color: style.iconColor, width: "1.125rem", height: "1.125rem" }} />
                  </span>

                  {/* Arrow */}
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.16)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.40)",
                    }}
                  >
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>

                <div className="mt-5">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>

                  {/* Count badge */}
                  <div className="mt-4">
                    <span
                      className="inline-flex items-baseline gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        background: count > 0 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
                        color: count > 0 ? "#FFFFFF" : "#A3A3A3",
                        border: count > 0 ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.10)",
                      }}
                    >
                      <span className="font-mono font-semibold tabular-nums">{count}</span>
                      {" "}
                      <span>{countLabel}</span>
                    </span>
                  </div>
                </div>

                {/* Bottom accent line */}
                <div
                  aria-hidden
                  className="absolute bottom-0 left-0 right-0 h-0.5 scale-x-0 rounded-b-card transition-transform duration-300 group-hover:scale-x-100"
                  style={{ background: "linear-gradient(90deg, #FFFFFF, #8A8A8A)" }}
                />
              </Link>
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
