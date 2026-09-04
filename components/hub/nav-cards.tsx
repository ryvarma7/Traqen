import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
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
  Icon: React.ComponentType<{ className?: string }>;
};

export function NavCards({ cards }: { cards: HubCard[] }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
    >
      {cards.map(({ href, title, description, count, countLabel, Icon }) => (
        <motion.div key={href} variants={card}>
          <motion.div
            whileHover={{
              scale: 1.02,
              boxShadow: "0 4px 16px rgba(28, 28, 26, 0.08)",
              transition: { duration: 0.15 },
            }}
            whileTap={{ scale: 0.98 }}
            className="h-full"
          >
            <Link
              href={href}
              className="flex h-full min-h-40 flex-col justify-between rounded-card border border-border bg-surface p-5 transition-colors"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-field bg-accent-soft">
                  <Icon className="h-4 w-4 text-accent" />
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="mt-6">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
                <p className="mt-3 text-xs font-medium text-foreground">
                  <span className="font-mono font-semibold tabular-nums">
                    {count}
                  </span>{" "}
                  <span className="text-muted-foreground">{countLabel}</span>
                </p>
              </div>
            </Link>
          </motion.div>
        </motion.div>
      ))}
    </motion.div>
  );
}
