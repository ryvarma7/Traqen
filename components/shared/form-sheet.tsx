"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useIsMobile } from "@/lib/hooks";

const spring = { type: "spring", stiffness: 380, damping: 34 } as const;

/** Bottom sheet on mobile (spring slide-up), centered modal on desktop
 *  (scale + fade) — per spec. */
export function FormSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-foreground/25"
            onClick={onClose}
          />

          {isMobile ? (
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={spring}
              className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-card bg-surface shadow-sheet"
            >
              <SheetHeader title={title} onClose={onClose} />
              <div className="overflow-y-auto px-5 pb-8 pt-1">{children}</div>
            </motion.div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-card bg-surface shadow-modal"
              >
                <SheetHeader title={title} onClose={onClose} />
                <div className="overflow-y-auto px-6 pb-6 pt-1">{children}</div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}

function SheetHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5 md:px-6">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="flex h-9 w-9 items-center justify-center rounded-field text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </motion.button>
    </div>
  );
}
