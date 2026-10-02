"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { ModalShell } from "@/components/shared/modal-shell";

/** Centre-screen confirmation for destructive actions — replaces
 *  `window.confirm`, which can't be styled and doesn't work in the app shell. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
}) {
  return (
    <ModalShell open={open} onClose={busy ? () => {} : onClose}>
      <div className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field border border-danger-border/70 bg-danger-soft/70">
            <TriangleAlert className="h-4 w-4 text-danger" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {body}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="glass-btn-base glass-btn-outline h-10 rounded-field px-4 text-sm disabled:opacity-60"
          >
            Cancel
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="glass-btn-base glass-btn-danger h-10 gap-2 rounded-field px-4 text-sm disabled:opacity-60"
          >
            {busy && <ThinkingOrb state="solving" size={20} theme="light" />}
            {busy ? "Deleting…" : confirmLabel}
          </motion.button>
        </div>
      </div>
    </ModalShell>
  );
}