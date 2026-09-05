"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Briefcase, ClipboardList, StickyNote } from "lucide-react";
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
  icon: "briefcase" | "tasks" | "notes";
};

const icons = { briefcase: Briefcase, tasks: ClipboardList, notes: StickyNote };

// Each section card gets a subtle accent tint for the icon zone
const iconStyles: Record<HubCard["icon"], { bg: string; iconColor: string; border: string }> = {
  briefcase: {
    bg:        "linear-gradient(135deg, #FDF0DC 0%, #FAE8C8 100%)",
    border:    "rgba(217, 123, 10, 0.30)",
    iconColor: "#C06A08",
  },
  tasks: {
    bg:        "linear-gradient(135deg, #ECF1E4 0%, #E0E8D4 100%)",
    border:    "rgba(107, 116, 76, 0.35)",
    iconColor: "#4A5730",
  },
  notes: {
    bg:        "linear-gradient(135deg, #FDF0DC 0%, #F8E4C0 100%)",
    border:    "rgba(217, 123, 10, 0.28)",
    iconColor: "#C06A08",
  },
};

export function NavCards({ cards }: { cards: HubCard[] }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
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
                    background: "radial-gradient(ellipse at 30% 0%, rgba(217,123,10,0.05) 0%, transparent 60%)",
                  }}
                />

                <div className="flex items-start justify-between">
                  {/* Icon container */}
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-[10px] transition-transform duration-200 group-hover:scale-105"
                    style={{
                      background: style.bg,
                      border: `1px solid ${style.border}`,
                      boxShadow: "0 1px 3px rgba(38,43,26,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
                    }}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ color: style.iconColor, width: "1.125rem", height: "1.125rem" }} />
                  </span>

                  {/* Arrow */}
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5"
                    style={{
                      background: "rgba(255,255,255,0.65)",
                      border: "1px solid rgba(200,197,168,0.60)",
                      boxShadow: "0 1px 3px rgba(38,43,26,0.06)",
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
                        background: count > 0 ? "rgba(217,123,10,0.10)" : "rgba(38,43,26,0.05)",
                        color: count > 0 ? "#C06A08" : "#717863",
                        border: count > 0 ? "1px solid rgba(217,123,10,0.22)" : "1px solid rgba(38,43,26,0.10)",
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
                  style={{ background: "linear-gradient(90deg, #D97B0A, #F0A030)" }}
                />
              </Link>
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
