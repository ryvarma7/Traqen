"use client";

import * as React from "react";

const getServerSnapshot = () => false;

export function useIsMobile(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const subscribe = React.useCallback((notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, [query]);
  const getSnapshot = React.useCallback(() => window.matchMedia(query).matches, [query]);

  // Preserve the server's snapshot during hydration, but read the actual
  // viewport immediately on client navigation instead of waiting for an effect.
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
