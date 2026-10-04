"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, StickyNote } from "lucide-react";
import { ColorDot } from "@/components/notes/color-dot";
import { SegmentedTabs } from "@/components/hub/segmented-tabs";
import { relativeTime } from "@/lib/dates";

export type NotePreview = {
  id: string;
  title: string;
  content: string | null;
  color: string;
  pinned: boolean;
  updated_at: string;
};

/**
 * Horizontally scrolling row of note previews, deliberately running past the
 * right edge of the card so it reads as scrollable.
 *
 * "Recents" and "Pinned" stand in for the reference's Recents/Suggested pair —
 * pinned is a real field on Traqen notes, whereas "suggested" would be a new
 * ranking feature and this pass is visual only.
 */
export function NotesCarousel({ notes }: { notes: NotePreview[] }) {
  const [tab, setTab] = React.useState<"recent" | "pinned">("recent");

  const visible = React.useMemo(() => {
    const sorted = [...notes].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    return tab === "pinned" ? sorted.filter((n) => n.pinned) : sorted;
  }, [notes, tab]);

  return (
    <section className="panel mb-4 overflow-hidden" aria-label="Notes">
      <header className="flex items-center justify-between gap-3 px-4 pt-4 md:px-5">
        <h2 className="text-base font-medium tracking-tight text-foreground">
          Notes
          <span className="ml-2 text-2xs font-normal text-muted-foreground/70">
            {visible.length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <SegmentedTabs
            tabs={[
              { key: "recent", label: "Recents" },
              { key: "pinned", label: "Pinned" },
            ]}
            value={tab}
            onChange={setTab}
          />
          <Link
            href="/notes"
            aria-label="All notes"
            className="rounded-field p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground/70 md:px-5">
          {tab === "pinned" ? "No pinned notes yet." : "No notes yet."}
        </p>
      ) : (
        <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-4 md:px-5">
          {visible.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.04, ease: "easeOut" }}
              className="w-60 shrink-0 sm:w-64"
            >
              <Link
                href="/notes"
                className="block h-56 rounded-card border border-white/10 bg-card-hover p-3.5 transition-colors hover:border-white/20"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
                    <StickyNote className="h-3 w-3" strokeWidth={1.75} />
                    Note
                    <ColorDot color={note.color} />
                  </span>
                  <span className="shrink-0 text-2xs text-muted-foreground/60">
                    {relativeTime(note.updated_at)}
                  </span>
                </div>

                <p className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-foreground">
                  {note.title}
                </p>

                {/* Bulleted preview, masked at the bottom so the text fades
                    instead of being cut on a hard edge. */}
                <div className="fade-bottom mt-2 max-h-32 overflow-hidden">
                  <ul className="space-y-1">
                    {previewLines(note.content).map((line, idx) => (
                      <li
                        key={idx}
                        className="flex gap-1.5 text-2xs leading-relaxed text-muted-foreground"
                      >
                        <span aria-hidden className="mt-1.5 h-0.5 w-0.5 shrink-0 rounded-full bg-muted-foreground/60" />
                        <span className="line-clamp-1">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Body text → up to five bullet lines, so a note's structure previews. */
function previewLines(content: string | null): string[] {
  if (!content) return [];
  return content
    .split(/\r?\n+/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}