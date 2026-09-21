"use client";

import { useEffect } from "react";

// Registers the service worker so the app shell caches for fast launches.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration is a progressive enhancement — ignore failures.
      });
    }
  }, []);

  return null;
}
