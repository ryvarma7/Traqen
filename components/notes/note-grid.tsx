"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, LoaderCircle, Pin } from "lucide-react";
import { ColorDot } from "@/components/notes/color-dot";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { relativeTime } from "@/lib/dates";
import { blurIn, itemVariants, listItemTransition, listVariants } from "@/lib/motion";
import type { NoteListItem } from "@/lib/types";

type NoteGridProps = {
  notes: NoteListItem[];
  privacy: Record<string, boolean>;
  privacyPending: Record<string, boolean>;
  onOpen: (note: NoteListItem) => void;
  onTogglePrivacy: (note: NoteListItem) => void;
};

// Draft edits stay in NotesView; only note data and visibility updates reach here.
export const NoteGrid = React.memo(function NoteGrid({
  notes,
  privacy,
  privacyPending,
  onOpen,
  onTogglePrivacy,
}: NoteGridProps) {
  const reducedMotion = useMotionPreferences();

  return (
    <motion.div
      variants={listVariants}
      initial={reducedMotion ? false : "hidden"}
      animate="visible"
      className="columns-1 gap-3.5 sm:columns-2 lg:columns-3"
    >
      {notes.map((note, index) => {
        const hidden = privacy[note.id] ?? note.private;
        const pending = privacyPending[note.id];

        return (
          <motion.div
            key={note.id}
            layout={reducedMotion ? false : "position"}
            variants={itemVariants}
            custom={index}
            initial={reducedMotion ? false : "hidden"}
            animate={reducedMotion ? blurIn.animate : "visible"}
            transition={reducedMotion ? { duration: 0 } : listItemTransition(index)}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(note)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(note);
              }
            }}
            className="mb-3.5 flex min-h-32 w-full cursor-pointer break-inside-avoid flex-col rounded-card glass-tile glass-tile-hover p-4 text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              {note.color !== "gray" && <ColorDot color={note.color} />}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {note.title}
              </span>
              {note.content && (
                <button
                  type="button"
                  aria-label={
                    pending
                      ? "Updating note visibility"
                      : hidden
                        ? "Show preview on notes page"
                        : "Hide preview on notes page"
                  }
                  title={hidden ? "Show preview" : "Hide preview"}
                  aria-busy={pending}
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePrivacy(note);
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-field text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-70"
                >
                  {pending ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : hidden ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              {note.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            </div>
            {note.content &&
              (hidden ? (
                <p className="mt-1.5 text-xs italic text-muted-foreground">Content hidden</p>
              ) : (
                <p className="mt-1.5 line-clamp-5 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {note.content}
                </p>
              ))}
            <span className="mt-auto pt-3 text-2xs text-muted-foreground">
              {relativeTime(note.updated_at)}
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
});
