"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { CountdownPill } from "@/components/shared/countdown-pill";

export type AttentionItem = {
  id: string;
  href: string;
  title: string;
  meta: string;
  date: string;
};

export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Needs attention" className="mb-6">
      <h2 className="mb-2.5 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        <span
          className="inline-block h-1.5 w-4 rounded-full"
          style={{ background: "linear-gradient(90deg, #FFFFFF, #8A8A8A)" }}
          aria-hidden
        />
        Needs attention
      </h2>
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-x-visible md:px-0 lg:grid-cols-3">
        {items.map((item, i) => (
          <motion.div
            key={`${item.id}-${item.date}`}
            initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
            animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
            transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
            className="shrink-0 md:shrink md:min-w-0"
          >
            <Link
              href={item.href}
              className="group flex min-w-56 items-center justify-between gap-3 rounded-card glass-tile px-3.5 py-2.5 transition-all hover:shadow-lift md:min-w-0"
              style={{
                borderLeft: "3px solid rgba(255, 255, 255, 0.85)",
              }}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">
                  {item.title}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-2xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3 shrink-0 text-muted-foreground" />
                  {item.meta}
                </p>
              </div>
              <CountdownPill date={item.date} className="shrink-0" />
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
