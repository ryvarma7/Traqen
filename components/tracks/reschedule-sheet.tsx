"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarSync, Check } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { toast } from "sonner";
import { FormSheet } from "@/components/shared/form-sheet";
import { rescheduleTrackItems } from "@/lib/actions/tracks";
import { formatShortDate, todayISO } from "@/lib/dates";
import { haptics } from "@/lib/haptics";
import { applyReschedule, reschedulePreview } from "@/lib/track-plan";
import type { TrackItem } from "@/lib/types";

/**
 * Shifts every not-done dated task forward so the next open task starts on the
 * chosen date, preserving the spacing between tasks. Two steps on purpose:
 * pick a date, then read back exactly what will move before committing.
 */
export function RescheduleSheet({
  open,
  onClose,
  trackId,
  items,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  trackId: string;
  items: TrackItem[];
  onApplied: (shift: Map<string, string>) => void;
}) {
  const [date, setDate] = React.useState(todayISO);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const preview = React.useMemo(
    () => (date ? reschedulePreview(items, date) : { count: 0, delta: 0 }),
    [items, date]
  );

  const close = () => {
    if (busy) return;
    setConfirming(false);
    setDate(todayISO());
    onClose();
  };

  const apply = async () => {
    if (busy || preview.count === 0 || preview.delta === 0) return;
    const shift = applyReschedule(items, date);

    setBusy(true);
    const result = await rescheduleTrackItems(trackId, date);
    setBusy(false);

    if (result.error) {
      haptics.error();
      toast.error(result.error);
      return;
    }

    haptics.success();
    const moved = result.moved ?? preview.count;
    toast.success(`Moved ${moved} ${moved === 1 ? "step" : "steps"}`);
    setConfirming(false);
    setDate(todayISO());
    onApplied(shift);
    onClose();
  };

  return (
    <FormSheet open={open} onClose={close} title="Reschedule remaining">
      <div className="space-y-5 pb-2">
        <AnimatePresence mode="wait">
          {!confirming ? (
            <motion.div
              key="pick"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-4"
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                Pick the date your next step should land on. Every step you
                haven&apos;t finished shifts by the same amount, so the spacing
                between them — and the order of your phases — stays exactly as
                it is.
              </p>

              <div className="flex items-center gap-3">
                <label
                  htmlFor="reschedule-start"
                  className="shrink-0 text-sm font-medium text-muted-foreground"
                >
                  Start date
                </label>
                <input
                  id="reschedule-start"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    haptics.selection();
                    setDate(e.target.value);
                  }}
                  className="glass-input focus-ring h-11 flex-1 rounded-field px-3 text-sm text-foreground [color-scheme:dark]"
                />
              </div>

              {preview.count === 0 ? (
                <p className="rounded-field border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-muted-foreground">
                  There are no dated steps left to move.
                </p>
              ) : preview.delta === 0 ? (
                <p className="rounded-field border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-muted-foreground">
                  That&apos;s already where your next step starts — pick another
                  date to shift the plan.
                </p>
              ) : (
                <p className="rounded-field border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-muted-foreground">
                  {preview.count} open {preview.count === 1 ? "step" : "steps"} will
                  move by{" "}
                  <span className="font-mono tabular-nums text-foreground">
                    {preview.delta > 0 ? "+" : ""}
                    {preview.delta} {preview.delta === 1 ? "day" : "days"}
                  </span>
                  .
                </p>
              )}

              <div className="flex justify-end">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => {
                    haptics.selection();
                    setConfirming(true);
                  }}
                  disabled={preview.count === 0 || preview.delta === 0}
                  className="glass-btn-base glass-btn-primary h-11 gap-2 rounded-field px-4 text-sm disabled:opacity-40"
                >
                  <CalendarSync className="h-4 w-4" /> Review shift
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="space-y-4"
            >
              <div className="rounded-field glass-section px-4 py-4 text-center">
                <p className="text-lg font-semibold tracking-tight text-foreground">
                  {preview.count} {preview.count === 1 ? "task" : "tasks"} will move
                  by {Math.abs(preview.delta)}{" "}
                  {Math.abs(preview.delta) === 1 ? "day" : "days"}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {preview.delta > 0 ? "Later" : "Earlier"} than now, starting{" "}
                  {formatShortDate(date)}.
                </p>
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                Steps you&apos;ve already finished keep their dates.
              </p>

              <div className="flex justify-between gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setConfirming(false);
                  }}
                  disabled={busy}
                  className="glass-btn-base glass-btn-outline h-11 gap-2 rounded-field px-4 text-sm disabled:opacity-60"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={apply}
                  disabled={busy}
                  className="glass-btn-base glass-btn-primary h-11 gap-2 rounded-field px-5 text-sm disabled:opacity-60"
                >
                  {busy ? (
                    <ThinkingOrb state="solving" size={20} theme="light" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {busy ? "Shifting…" : "Confirm shift"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FormSheet>
  );
}