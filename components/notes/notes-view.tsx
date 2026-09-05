"use client";

import * as React from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Pencil, Pin, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ColorDot, NOTE_COLORS } from "@/components/notes/color-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteNote, saveNote } from "@/lib/actions/notes";
import { relativeTime } from "@/lib/dates";
import { useIsMobile } from "@/lib/hooks";
import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const tileVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export function NotesView({ notes }: { notes: Note[] }) {
  const [viewingId, setViewingId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  // Draft state while creating or editing in place.
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [color, setColor] = React.useState("gray");
  const [pinned, setPinned] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const isMobile = useIsMobile();
  const viewing = notes.find((n) => n.id === viewingId) ?? null;

  const sorted = React.useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }),
    [notes]
  );

  const openNew = () => {
    setTitle("");
    setContent("");
    setColor("gray");
    setPinned(false);
    setCreating(true);
    setViewingId(null);
    setEditing(false);
  };

  const openNote = (note: Note) => {
    setTitle(note.title);
    setContent(note.content ?? "");
    setColor(note.color);
    setPinned(note.pinned);
    setViewingId(note.id);
    setCreating(false);
    setEditing(false);
  };

  const close = () => {
    setViewingId(null);
    setCreating(false);
    setEditing(false);
  };

  const save = async () => {
    if (!title.trim()) {
      toast.error("A note needs a title");
      return;
    }
    setBusy(true);
    const result = await saveNote(
      { title: title.trim(), content, color, pinned },
      creating ? undefined : viewingId ?? undefined
    );
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(creating ? "Note added" : "Note saved");
    close();
  };

  const remove = async () => {
    if (!viewingId) return;
    setBusy(true);
    const result = await deleteNote(viewingId);
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Note deleted");
    close();
  };

  const startEditing = () => {
    if (!viewing) return;
    setTitle(viewing.title);
    setContent(viewing.content ?? "");
    setColor(viewing.color);
    setPinned(viewing.pinned);
    setEditing(true);
  };

  const overlayOpen = creating || viewing !== null;

  return (
    <div>
      {sorted.length === 0 && !creating ? (
        <div className="flex flex-col items-center rounded-card glass-section border-dashed px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            No notes yet. Write your first one.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={openNew}
            className="mt-4 glass-btn-base glass-btn-primary h-10 gap-2 rounded-field px-4 text-sm"
          >
            <Plus className="h-4 w-4" /> Add note
          </motion.button>
        </div>
      ) : (
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="columns-1 gap-3.5 sm:columns-2 lg:columns-3"
        >
          {sorted.map((note) => (
            <motion.button
              key={note.id}
              variants={tileVariants}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => openNote(note)}
              className="mb-3.5 flex min-h-32 w-full break-inside-avoid flex-col rounded-card glass-tile glass-tile-hover p-4 text-left"
            >
              <div className="flex items-center gap-2">
                {note.color !== "gray" && <ColorDot color={note.color} />}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {note.title}
                </span>
                {note.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </div>
              {note.content && (
                <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">
                  {note.content}
                </p>
              )}
              <span className="mt-auto pt-3 text-2xs text-muted-foreground">
                {relativeTime(note.updated_at)}
              </span>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Floating add button with glowing Framer glass aesthetic */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        type="button"
        aria-label="Add note"
        onClick={openNew}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full glass-btn-base glass-btn-primary shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      {/* Full view on mobile, centered on desktop — same view turns editable */}
      <AnimatePresence>
        {overlayOpen && (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-foreground/30"
              onClick={close}
            />
            <motion.div
              initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
              exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96 }}
              transition={
                isMobile
                  ? { type: "spring", stiffness: 380, damping: 34 }
                  : { duration: 0.18, ease: "easeOut" }
              }
              className={cn(
                "absolute flex flex-col glass-modal overflow-hidden",
                isMobile
                  ? "inset-0 rounded-t-card"
                  : "left-1/2 top-1/2 max-h-[85vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-card"
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/60 px-5 py-3.5">
                {editing || creating ? (
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Note title"
                    className="mr-2 h-9 border-transparent bg-transparent px-0 text-base font-semibold focus:border-transparent focus:ring-0"
                    autoFocus
                  />
                ) : (
                  <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                    {viewing && viewing.color !== "gray" && (
                      <ColorDot color={viewing.color} />
                    )}
                    <span className="truncate">{viewing?.title}</span>
                  </h2>
                )}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="glass-btn-base glass-btn-ghost flex h-8 w-8 shrink-0 items-center justify-center rounded-field text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 md:px-6">
                {editing || creating ? (
                  <div className="space-y-4">
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={10}
                      placeholder="Start writing…"
                      className="resize-none glass-input"
                    />
                    <div className="flex items-center gap-2">
                      <Label className="mr-1">Color</Label>
                      {Object.keys(NOTE_COLORS).map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Color ${c}`}
                          onClick={() => setColor(c)}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110",
                            color === c && "ring-2 ring-accent ring-offset-2"
                          )}
                        >
                          <ColorDot color={c} className="h-3.5 w-3.5" />
                        </button>
                      ))}
                      <label className="ml-auto flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pinned}
                          onChange={(e) => setPinned(e.target.checked)}
                          className="h-4 w-4 accent-accent rounded"
                        />
                        Pin
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    {viewing?.content ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {viewing.content}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Empty note.</p>
                    )}
                    <p className="mt-6 text-2xs text-muted-foreground">
                      Edited {relativeTime(viewing?.updated_at ?? new Date().toISOString())}
                    </p>
                  </>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2 border-t border-border bg-muted/60 px-5 py-3.5">
                {editing || creating ? (
                  <>
                    <Button size="lg" className="flex-1" disabled={busy} onClick={save}>
                      {busy ? "Saving…" : creating ? "Add note" : "Save"}
                    </Button>
                    <Button size="lg" variant="outline" onClick={close}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="lg" variant="outline" className="flex-1" onClick={startEditing}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="lg"
                      variant="ghost"
                      className="text-danger hover:bg-danger-soft hover:text-danger"
                      onClick={remove}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
