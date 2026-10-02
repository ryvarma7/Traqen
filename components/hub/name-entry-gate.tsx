"use client";

import * as React from "react";
import { useProfile } from "@/lib/profile-store";

/** First-login gate: once the profile has loaded and the user has never set
 *  a name, open the shared rename modal in "first" mode. Fires once per
 *  session — persisting a name + router.refresh() take care of the rest. */
export function NameEntryGate({ needsName }: { needsName: boolean }) {
  const { loaded, openRename } = useProfile();
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (needsName && loaded && !fired.current) {
      fired.current = true;
      openRename("first");
    }
  }, [needsName, loaded, openRename]);

  return null;
}