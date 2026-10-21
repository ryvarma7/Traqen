"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormSheet } from "@/components/shared/form-sheet";
import { LoadingBar } from "@/components/shared/loading-bar";
import { fieldLabelClass, inputClass } from "@/components/tracks/fields";
import { createTrackPhase, deleteTrackPhase, updateTrackPhase } from "@/lib/actions/tracks";
import { haptics } from "@/lib/haptics";
import type { TrackPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Edits a phase, or adds one.
 *
 * Removing a phase removes the steps inside it, so it asks for confirmation
 * and says how many steps go with it.
 */
export function PhaseSheet({
  open,
  onClose,
  trackId,
  phase,
  stepCount,
}: {
  open: boolean;
  onClose: () => void;
  trackId: string;
  /** The phase being edited, or null to add a new one. */
  phase: TrackPhase | null;
  /** How many steps the phase holds, for the removal warning. */
  stepCount: number;
}) {
  const router = useRouter();
  const editing = phase !== null;

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(phase?.title ?? "");
    setDescription(phase?.description ?? "");
    setError(null);
  }, [open, phase]);

  const close = () => {
    if (busy) return;
    onClose();
  };

  const fail = (message: string) => {
    setError(message);
    haptics.error();
    toast.error(message);
  };

  const save = async () => {
    if (busy) return;
    if (!title.trim()) {
      fail("Give the phase a title.");
      return;
    }

    setBusy(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
    };
    const result = editing
      ? await updateTrackPhase(phase.id, payload)
      : await createTrackPhase(trackId, payload);
    setBusy(false);

    if (result.error) {
      fail(result.error);
      return;
    }

    haptics.success();
    toast.success(editing ? "Phase updated" : "Phase added");
    router.refresh();
    onClose();
  };

  const remove = async () => {
    if (busy || !phase) return;
    const warning =
      stepCount > 0
        ? `Remove "${phase.title}" and its ${stepCount} ${stepCount === 1 ? "step" : "steps"}?`
        : `Remove "${phase.title}"?`;
    if (!window.confirm(warning)) return;

    setBusy(true);
    const result = await deleteTrackPhase(phase.id);
    setBusy(false);

    if (result.error) {
      fail(result.error);
      return;
    }

    haptics.delete();
    toast.success("Phase removed");
    router.refresh();
    onClose();
  };

  return (
    <FormSheet
      open={open}
      onClose={close}
      title={editing ? "Edit phase" : "Add a phase"}
    >
      <div className="space-y-4 pb-2">
        <div>
          <label htmlFor="phase-title" className={fieldLabelClass}>
            Title <span className="text-danger">*</span>
          </label>
          <input
            id="phase-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What this part of the course is about"
            className={cn(inputClass, !title.trim() && error && "border-danger/70")}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="phase-description" className={fieldLabelClass}>
            Goal
          </label>
          <textarea
            id="phase-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What the learner can do by the end of this phase"
            rows={4}
            className={cn(inputClass, "resize-y leading-relaxed")}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-field border border-danger-border/70 bg-danger-soft/60 px-3 py-2 text-xs leading-relaxed text-danger"
          >
            {error}
          </p>
        )}

        {editing && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="glass-btn-base glass-btn-ghost flex h-11 w-full items-center justify-center gap-2 rounded-field text-xs text-danger hover:bg-danger-soft/60 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Remove phase
          </button>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="glass-btn-base glass-btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-field text-sm disabled:opacity-60"
        >
          {busy ? <LoadingBar className="h-1 w-10" /> : <Check className="h-4 w-4" />}
          {busy ? "Saving…" : editing ? "Save phase" : "Add phase"}
        </motion.button>
      </div>
    </FormSheet>
  );
}
