"use client";

import * as React from "react";

/**
 * Shared client-side profile store. One fetch of the signed-in user's profile
 * (username + login email) serves the top-bar avatar and the rename modal on
 * every page, and keeps the hub greeting in sync after a rename without
 * re-hydrating the whole tree.
 *
 * The login email comes from the signed-in user's own profile row (RLS:
 * "Users can view own profile"). It's the account's real Google email and is
 * only ever rendered muted inside the user's own profile menu — never in
 * greetings or any visible copy.
 *
 * The rename modal's open state lives here too, so the hub's first-login
 * popup and the profile menu's "Rename" stay perfectly in sync: there is
 * only ever one modal, opened by calling openRename(mode).
 */

export type RenameMode = "first" | "rename";

interface ProfileState {
  username: string | null;
  email: string | null;
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
  const [profile, setProfile] = React.useState<ProfileState>({
    username: null,
    email: null,
    loaded: false,
  });
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [renameMode, setRenameMode] = React.useState<RenameMode>("rename");

  // Load once for the whole session.
  React.useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | { username?: string | null; email?: string | null }
        | null;
      if (!active) return;
      setProfile({
        username: data?.username ?? null,
        email: data?.email ?? null,
        loaded: true,
      });
    })();
    return () => {
      active = false;
    };
  }, []);

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