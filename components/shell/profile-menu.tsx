"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, LogOut, PenLine } from "lucide-react";
import { logOut } from "@/lib/actions/auth";
import { haptics } from "@/lib/haptics";
import { useIsMobile } from "@/lib/hooks";
import { useProfile } from "@/lib/profile-store";
import { ModalShell } from "@/components/shared/modal-shell";
import { cn } from "@/lib/utils";

/** Initials avatar — two-letter monogram from the display name. */
function avatarLabel(name: string | null) {
  const parts = (name ?? "").trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return "U";
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + (parts.length > 1 ? last : "")).toUpperCase();
}

/** Round profile button — tap to open the profile menu.
 *
 *  Two presentations, sharing one set of open/close state:
 *  - `icon` (default): a circular monogram for the mobile top bar.
 *  - `rail`: a full-width row showing the whole username, pinned to the
 *    bottom of the desktop sidebar. Its panel opens UPWARD, because there is
 *    no room below the bottom edge of the viewport.
 */
export function ProfileMenu({ variant = "icon" }: { variant?: "icon" | "rail" }) {
  const { username, email, openRename } = useProfile();
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const isRail = variant === "rail";

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Dismiss on any outside click (pointerdown beats click, so the avatar
    // toggle doesn't re-open what the outside handler just closed).
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

  const close = React.useCallback(() => setOpen(false), []);

  return (
    <div className={cn("relative", isRail && "w-full")} ref={rootRef}>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onTap={() => haptics.tap()}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        aria-label={isRail ? `Profile menu for ${username ?? "user"}` : "Profile menu"}
        className={cn(
          "select-none transition-all",
          isRail
            ? "focus-ring flex w-full items-center gap-2.5 rounded-field px-2 py-2 text-left hover:bg-white/[0.06]"
            : "flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-foreground hover:border-white/30 hover:bg-white/10 md:h-9 md:w-9"
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-white/10 font-semibold text-foreground",
            isRail ? "h-7 w-7 text-xs" : "h-full w-full text-sm"
          )}
        >
          {avatarLabel(username)}
        </span>

        {isRail && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {username ?? "Profile"}
            </span>
            <ChevronUp
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                open && "rotate-180"
              )}
              strokeWidth={1.75}
            />
          </>
        )}
      </motion.button>

      {!isMobile && (
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "glass-modal absolute z-50 overflow-hidden rounded-card",
                // Rail is pinned to the bottom of the viewport, so the panel
                // grows upward from it; the icon variant has room below.
                isRail
                  ? "bottom-full left-0 right-0 mb-1.5 w-full origin-bottom-left"
                  : "right-0 top-full mt-2 w-72 origin-top-right"
              )}
            >
              <MenuItems username={username} email={email} onClose={close} onRename={openRename} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {isMobile && (
        <ModalShell open={open} onClose={close} variant="sheet">
          <div className="pb-safe-sm px-2 pt-1">
            <MenuItems username={username} email={email} onClose={close} onRename={openRename} />
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function MenuItems({
  username,
  email,
  onClose,
  onRename,
}: {
  username: string | null;
  email: string | null;
  onClose: () => void;
  onRename: () => void;
}) {
  return (
    <div className="flex flex-col p-1.5">
      <div className="mb-1 flex flex-col gap-0.5 border-b border-white/10 px-3 pb-2.5 pt-1.5">
        <span className="text-sm font-semibold text-foreground">
          {username ?? "Loading…"}
        </span>
        {email && <span className="text-2xs text-muted-foreground">{email}</span>}
      </div>

      <MenuItem
        icon={<PenLine className="h-4 w-4" />}
        label="Rename username"
        onClick={() => {
          haptics.tap();
          onClose();
          onRename();
        }}
      />
      <MenuItem
        icon={<LogOut className="h-4 w-4" />}
        label="Log out"
        danger
        onClick={() => {
          haptics.warning();
          logOut();
        }}
      />
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
      onClick={onClick}
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-field px-3 py-2.5 text-left text-sm transition-colors",
        danger ? "text-danger hover:bg-danger/10" : "text-foreground hover:bg-white/10"
      )}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}