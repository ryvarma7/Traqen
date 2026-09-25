"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const spring = { type: "spring", stiffness: 380, damping: 34 } as const;

export function ModalShell({
  open,
  onClose,
  children,
  panelClassName,
  variant = "centered",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
  variant?: "centered" | "sheet";
}) {
  React.useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-0 bg-black/70"
            onClick={onClose}
          />

          <div
            className={cn(
              "relative z-10 flex min-h-full",
              variant === "sheet"
                ? "items-end justify-center p-0 pb-[env(safe-area-inset-bottom)]"
                : "items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            )}
          >
            <motion.div
              initial={
                variant === "sheet"
                  ? { y: "100%" }
                  : { opacity: 0, filter: "blur(8px)", scale: 0.98 }
              }
              animate={
                variant === "sheet"
                  ? { y: 0 }
                  : { opacity: 1, filter: "blur(0px)", scale: 1 }
              }
              exit={
                variant === "sheet"
                  ? { y: "100%" }
                  : { opacity: 0, filter: "blur(8px)", scale: 0.98 }
              }
              transition={variant === "sheet" ? spring : { duration: 0.25, ease: "easeOut" }}
              className={cn(
                "relative z-10 max-h-[90dvh] flex flex-col overflow-hidden glass-modal",
                variant === "sheet"
                  ? "w-full max-w-lg rounded-t-card rounded-b-none"
                  : "w-full max-w-lg rounded-card",
                panelClassName
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
