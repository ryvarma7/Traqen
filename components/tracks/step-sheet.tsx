"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormSheet } from "@/components/shared/form-sheet";
import { LoadingBar } from "@/components/shared/loading-bar";
import { fieldLabelClass, inputClass } from "@/components/tracks/fields";
import { Select } from "@/components/ui/select";
import {
  createTrackItem,
  deleteTrackItem,
  moveTrackItem,
  moveTrackItemToPhase,
  updateTrackItem,
} from "@/lib/actions/tracks";
import { haptics } from "@/lib/haptics";
import type { TrackItem, TrackPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Edits a step, or adds one.
 *
 * One sheet does both, because the fields are the same and the only real
 * difference is which action the save button calls. Moving is offered here
 * rather than as a drag handle: a step can be moved up or down inside its
 * phase, or into another phase, and all three are one tap on a phone.
 */
export function StepSheet({
  open,
  onClose,
  trackId,
  phaseId,
  phases,
  item,
}: {
  open: boolean;
  onClose: () => void;
  trackId: string;
  /** The phase a new step would be added to. */
  phaseId: string;
  phases: TrackPhase[];
  /** The step being edited, or null to add a new one. */
  item: TrackItem | null;
}) {
  const router = useRouter();
  const editing = item !== null;

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [date, setDate] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [targetPhase, setTargetPhase] = React.useState(phaseId);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The form is filled from the step each time the sheet opens, so it never
  // shows the previous step's values.
  React.useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setDate(item?.target_date ?? "");
    setUrl(item?.resource_url ?? "");
    setTargetPhase(item?.phase_id ?? phaseId);
    setError(null);
  }, [open, item, phaseId]);

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
      fail("Give the step a title.");
      return;
    }

    setBusy(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      resource_url: url.trim() || null,
      target_date: date || null,
    };

    const result = editing
      ? await updateTrackItem(item.id, payload)
      : await createTrackItem(trackId, phaseId, payload);
    setBusy(false);

    if (result.error) {
      fail(result.error);
      return;
    }

    haptics.success();
    toast.success(editing ? "Step updated" : "Step added");
    router.refresh();
    onClose();
  };

  const remove = async () => {
    if (busy || !item) return;
    if (!window.confirm(`Remove "${item.title}"?`)) return;

    setBusy(true);
    const result = await deleteTrackItem(item.id);
    setBusy(false);

    if (result.error) {
      fail(result.error);
      return;
    }

    haptics.delete();
    toast.success("Step removed");
    router.refresh();
    onClose();
  };

  const shift = async (direction: "up" | "down") => {
    if (busy || !item) return;
    setBusy(true);
    const result = await moveTrackItem(item.id, direction);
    setBusy(false);

    if (result.error) {
      fail(result.error);
      return;
    }

    haptics.tapLight();
    router.refresh();
  };

  const rephase = async (nextPhaseId: string) => {
    if (busy || !item || nextPhaseId === item.phase_id) return;
    setBusy(true);
    const result = await moveTrackItemToPhase(item.id, nextPhaseId);
    setBusy(false);

    if (result.error) {
      fail(result.error);
      setTargetPhase(item.phase_id);
      return;
    }

    haptics.success();
    toast.success("Step moved");
    router.refresh();
  };

  return (
    <FormSheet
      open={open}
      onClose={close}
      title={editing ? "Edit step" : "Add a step"}
    >
      <div className="space-y-4 pb-2">
        <div>
          <label htmlFor="step-title" className={fieldLabelClass}>
            Title <span className="text-danger">*</span>
          </label>
          <input
            id="step-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What you do in this step"
            className={cn(inputClass, !title.trim() && error && "border-danger/70")}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="step-description" className={fieldLabelClass}>
            Instructions
          </label>
          <textarea
            id="step-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What to do, what done looks like, and how to check it"
            rows={5}
            className={cn(inputClass, "resize-y leading-relaxed")}
          />
        </div>

        <div>
          <label htmlFor="step-date" className={fieldLabelClass}>
            Due date
          </label>
          <input
            id="step-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={cn(inputClass, "h-10 text-sm [color-scheme:dark]")}
          />
          <p className="mt-1 text-2xs text-muted-foreground/70">
            A step with no date still shows on the plan, but it never reaches
            the calendar.
          </p>
        </div>

        <div>
          <label htmlFor="step-url" className={fieldLabelClass}>
            Resource link
          </label>
          <input
            id="step-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
            inputMode="url"
            className={inputClass}
            autoComplete="off"
          />
        </div>

        {editing && phases.length > 1 && (
          <div>
            <label htmlFor="step-phase" className={fieldLabelClass}>
              Phase
            </label>
            <Select
              id="step-phase"
              value={targetPhase}
              onChange={(event) => {
                setTargetPhase(event.target.value);
                void rephase(event.target.value);
              }}
              disabled={busy}
              className="h-10"
            >
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.title}
                </option>
              ))}
            </Select>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-field border border-danger-border/70 bg-danger-soft/60 px-3 py-2 text-xs leading-relaxed text-danger"
          >
            {error}
          </p>
        )}

        {editing && (
          <div className="flex items-center gap-2 border-t border-white/[0.06] pt-4">
            <button
              type="button"
              onClick={() => void shift("up")}
              disabled={busy}
              aria-label="Move step up"
              className="glass-btn-base glass-btn-ghost flex h-11 w-11 items-center justify-center rounded-field text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void shift("down")}
              disabled={busy}
              aria-label="Move step down"
              className="glass-btn-base glass-btn-ghost flex h-11 w-11 items-center justify-center rounded-field text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="glass-btn-base glass-btn-ghost ml-auto flex h-11 items-center gap-2 rounded-field px-3 text-xs text-danger hover:bg-danger-soft/60 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="glass-btn-base glass-btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-field text-sm disabled:opacity-60"
        >
          {busy ? <LoadingBar className="h-1 w-10" /> : <Check className="h-4 w-4" />}
          {busy ? "Saving…" : editing ? "Save step" : "Add step"}
        </motion.button>
      </div>
    </FormSheet>
  );
}
