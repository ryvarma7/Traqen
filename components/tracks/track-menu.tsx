"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarSync, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { ModalShell } from "@/components/shared/modal-shell";
import { haptics } from "@/lib/haptics";
import { useIsMobile } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/** Track overflow menu: hold/resume, reschedule, delete. Delete is gated
 *  behind a confirmation dialog owned by the caller. */
export function TrackMenu({
  onHold,
  onResume,
  onReschedule,
  onDelete,
}: {
  onHold?: () => void;
  onResume?: () => void;
  onReschedule: () => void;
  onDelete: () => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // pointerdown (not click) so the trigger toggle can't immediately re-open
    // what the outside handler just closed.
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const items: React.ReactNode = (
    <div className="flex flex-col p-1.5">
      <MenuItem
        icon={<CalendarSync className="h-4 w-4" />}
        label="Reschedule remaining"
        onClick={() => {
          haptics.tap();
          setOpen(false);
          onReschedule();
        }}
      />
      {onHold && (
        <MenuItem
          icon={<PauseCircle className="h-4 w-4" />}
          label="Put on hold"
          onClick={() => {
            haptics.tap();
            setOpen(false);
            onHold();
          }}
        />
      )}
      {onResume && (
        <MenuItem
          icon={<PlayCircle className="h-4 w-4" />}
          label="Resume track"
          onClick={() => {
            haptics.tap();
            setOpen(false);
            onResume();
          }}
        />
      )}
      <div className="my-1 border-t border-white/10" />
      <MenuItem
        icon={<Trash2 className="h-4 w-4" />}
        label="Delete track"
        danger
        onClick={() => {
          haptics.warning();
          setOpen(false);
          onDelete();
        }}
      />
    </div>
  );

  return (
    <div className="relative" ref={rootRef}>
      <motion.button
        whileTap={{ scale: 0.94 }}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Track options"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring glass-btn-base glass-btn-outline flex h-10 w-10 items-center justify-center rounded-field text-base font-semibold leading-none text-foreground"
      >
        ⋯
      </motion.button>

      {!isMobile && (
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              role="menu"
              aria-label="Track options"
              className="glass-modal absolute right-0 top-full z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-card"
            >
              {items}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {isMobile && (
        <ModalShell open={open} onClose={() => setOpen(false)} variant="sheet">
          <div role="menu" aria-label="Track options" className="pb-safe-sm">
            {items}
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "focus-ring flex min-h-11 w-full items-center gap-2.5 rounded-field px-3 py-2.5 text-left text-sm transition-colors",
        danger ? "text-danger hover:bg-danger/10" : "text-foreground hover:bg-white/10"
      )}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}