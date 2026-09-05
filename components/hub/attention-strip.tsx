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
          style={{ background: "linear-gradient(90deg, #D97B0A, #F0A030)" }}
          aria-hidden
        />
        Needs attention
      </h2>
      <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {items.map((item, i) => (
          <motion.div
            key={`${item.id}-${item.date}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.04, ease: "easeOut" }}
            className="md:flex-1 md:min-w-0"
          >
            <Link
              href={item.href}
              className="group flex min-w-56 items-center justify-between gap-3 rounded-card glass-tile px-3.5 py-2.5 transition-all hover:shadow-lift md:min-w-0"
              style={{
                borderLeft: "3px solid #D97B0A",
              }}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">
                  {item.title}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-2xs text-muted-foreground">
                  <CalendarClock className="h-3 w-3 shrink-0" style={{ color: "#D97B0A", opacity: 0.8 }} />
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
