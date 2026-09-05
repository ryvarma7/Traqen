"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

/** Inline quick-edit for a record's notes field. Calls a notes-only server
 *  action; the record re-renders with fresh data after revalidation. */
export function NotesInline({
  notes,
  onSave,
}: {
  notes: string | null;
  onSave: (notes: string) => Promise<{ error?: string }>;
}) {
  const [value, setValue] = React.useState(notes ?? "");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setValue(notes ?? ""), [notes]);

  const start = () => {
    setDraft(value);
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    const result = await onSave(draft);
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setValue(draft.trim());
    setEditing(false);
    toast.success("Notes saved");
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          Notes
        </span>
        {!editing && (
          <button
            type="button"
            aria-label="Edit notes"
            onClick={start}
            className="rounded-field p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Add notes…"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="glass-btn-base glass-btn-primary h-9 rounded-field px-3.5 text-sm"
            >
              {busy ? "Saving…" : "Save notes"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="glass-btn-base glass-btn-outline h-9 rounded-field px-3.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : value ? (
        <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
          {value}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">No notes yet.</p>
      )}
    </div>
  );
}