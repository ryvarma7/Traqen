"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Shared client-side profile store. One fetch of the signed-in user's profile
 * (username) serves the top-bar avatar and the rename modal on
 * every page, and keeps the hub greeting in sync after a rename without
 * re-hydrating the whole tree.
 *
 * The real Google email stays server-side and never crosses the UI boundary.
 *
 * The rename modal's open state lives here too, so the hub's first-login
 * popup and the profile menu's "Rename" stay perfectly in sync: there is
 * only ever one modal, opened by calling openRename(mode).
 */

export type RenameMode = "first" | "rename";

interface ProfileState {
  username: string | null;
  /** Set once the first fetch resolves (success or not) so the hub gate
   *  never waits forever on a hung request. */
  loaded: boolean;
}

interface ProfileContextValue extends ProfileState {
  renameOpen: boolean;
  renameMode: RenameMode;
  openRename: (mode?: RenameMode) => void;
  closeRename: () => void;
  /** Persisted a rename — update the shared username + close the modal. */
  rename: (username: string) => void;
}

const ProfileContext = React.createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicRoute = pathname === "/login" || pathname === "/signup";
  const [profile, setProfile] = React.useState<ProfileState>({
    username: null,
    loaded: false,
  });
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [renameMode, setRenameMode] = React.useState<RenameMode>("rename");

  // Load once when entering the app, not on the public login page or on every
  // section change. Clear the previous user's display state on logout.
  React.useEffect(() => {
    setRenameOpen(false);
    setProfile({ username: null, loaded: publicRoute });
    if (publicRoute) return;

    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    (async () => {
      try {
        const res = await fetch("/api/profile", {
          cache: "no-store", signal: controller.signal,
        });
        const data = (await res.json().catch(() => null)) as
          | { username?: string | null }
          | null;
        if (active && res.ok) {
          setProfile({
            username: typeof data?.username === "string" ? data.username : null,
            loaded: true,
          });
        }
      } catch {
        // Network failures must not leave onboarding waiting forever.
      } finally {
        window.clearTimeout(timeout);
        if (active) setProfile((p) => ({ ...p, loaded: true }));
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [publicRoute]);

  const openRename = React.useCallback((mode: RenameMode = "rename") => {
    setRenameMode(mode);
    setRenameOpen(true);
  }, []);

  const closeRename = React.useCallback(() => setRenameOpen(false), []);

  const rename = React.useCallback((username: string) => {
    setProfile((p) => ({ ...p, username }));
    setRenameOpen(false);
  }, []);

  const value = React.useMemo<ProfileContextValue>(
    () => ({ ...profile, renameOpen, renameMode, openRename, closeRename, rename }),
    [profile, renameOpen, renameMode, openRename, closeRename, rename]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = React.useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
