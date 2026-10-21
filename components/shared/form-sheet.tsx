"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useIsMobile } from "@/lib/hooks";
import { ModalShell } from "@/components/shared/modal-shell";

/** Bottom sheet on mobile, centered modal on desktop with portal-based positioning */
export function FormSheet({
  open,
  onClose,
  title,
  headerRight,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <ModalShell open={open} onClose={onClose} variant={isMobile ? "sheet" : "centered"}>
      <SheetHeader title={title} headerRight={headerRight} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-safe pt-4 md:px-6 md:pb-6">{children}</div>
    </ModalShell>
  );
}

function SheetHeader({
  title,
  headerRight,
  onClose,
}: {
  title: string;
  headerRight?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/60 px-5 py-3.5 md:px-6">
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {headerRight}
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="glass-btn-base glass-btn-ghost flex h-11 w-11 items-center justify-center rounded-field text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </motion.button>
    </div>
  );
}
