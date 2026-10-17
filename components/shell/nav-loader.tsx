"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LoadingBar } from "@/components/shared/loading-bar";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { createFrameScheduler } from "@/lib/frame-scheduler";
import { blurIn, blurInTransition } from "@/lib/motion";

/** How long a navigation must run before the veil is allowed to appear. A
 *  section change that resolves faster than this never shows it, so quick
 *  navigation doesn't strobe. */
const APPEAR_AFTER = 120;

/** Floor on how long the veil stays once it is up, so it doesn't blink out on
 *  the same frame the new page paints. */
const MIN_VISIBLE = 320;

/** Backstop for a navigation that starts but never lands (cancelled, blocked,
 *  same-route click that fell through) — otherwise the veil would sit there. */
const WATCHDOG = 10_000;

const startListeners = new Set<() => void>();

/** The visible slice of the content column, in viewport coordinates. */
type Box = { left: number; top: number; width: number; height: number };

/** Raises the veil for navigations the click capture below can't see — the
 *  `router.push` calls, which never produce an anchor click. */
export function beginNav() {
  startListeners.forEach((fn) => fn());
}

/**
 * Navigation veil.
 *
 * Deliberately not a `loading.tsx`: a route-level fallback replaces the page
 * tree, which takes the sidebar and tab bar down with it and reads as a cold
 * boot. This layers over the live page instead — the content underneath stays
 * mounted and is only blurred, with the loading bar centred on top of it. So a section
 * change looks like the app refocusing, not like a new website opening.
 *
 * Start is captured from anchor clicks plus {@link beginNav}; end is the
 * pathname committing.
 */
export function NavLoader() {
  const reducedMotion = useMotionPreferences();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  const appearTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const watchdog = useRef<number | null>(null);
  const shownAt = useRef(0);

  const clear = useCallback((timer: React.MutableRefObject<number | null>) => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const end = useCallback(() => {
    clear(appearTimer);
    clear(watchdog);
    const wait = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt.current));
    clear(hideTimer);
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      setVisible(false);
    }, wait);
  }, [clear]);

  const begin = useCallback(() => {
    clear(appearTimer);
    clear(hideTimer);
    clear(watchdog);
    appearTimer.current = window.setTimeout(() => {
      appearTimer.current = null;
      shownAt.current = Date.now();
      setVisible(true);
      watchdog.current = window.setTimeout(end, WATCHDOG);
    }, APPEAR_AFTER);
  }, [clear, end]);

  // `document.body` is the portal target, so the loading bar can only render client-side.
  useEffect(() => setMounted(true), []);

  /* Centre the loading bar on the content column, not the window. The column's left
     edge sits past the sidebar on desktop, so a viewport-centred bar reads as
     off to one side; and the column is often taller than the viewport, so it
     has to be the *visible* slice that's measured. Re-measured on scroll and
     resize, since either moves the column out from under a fixed element. */
  const measure = useCallback(() => {
    const rect = columnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    const next = {
      left: rect.left,
      width: rect.width,
      top,
      height: Math.max(bottom - top, 0),
    };
    setBox((previous) => previous &&
      previous.left === next.left && previous.width === next.width &&
      previous.top === next.top && previous.height === next.height ? previous : next);
  }, []);

  useEffect(() => {
    if (!visible) return;
    measure();
    const frame = createFrameScheduler(measure);
    const observer = new ResizeObserver(frame.schedule);
    if (columnRef.current) observer.observe(columnRef.current);
    window.addEventListener("resize", frame.schedule, { passive: true });
    window.addEventListener("scroll", frame.schedule, { capture: true, passive: true });
    return () => {
      frame.cancel();
      observer.disconnect();
      window.removeEventListener("resize", frame.schedule);
      window.removeEventListener("scroll", frame.schedule, true);
    };
  }, [visible, measure]);

  // Anchor clicks — every <Link> in the sidebar, tab bar and card grids.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      // Controls can legally appear inside card links in the current UI. The
      // capture listener runs before the control's own onClick, so waiting for
      // preventDefault() there is too late: it would show the navigation veil
      // for an action that never navigates.
      if (
        target?.closest(
          "button, input, textarea, select, option, [role=button], [role=checkbox], [role=switch], [contenteditable=true]"
        )
      ) {
        return;
      }

      const anchor = target?.closest("a");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href || anchor.target === "_blank") return;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page — a filter, an anchor or a no-op; the pathname won't change.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      begin();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [begin]);

  // Programmatic navigation.
  useEffect(() => {
    startListeners.add(begin);
    return () => {
      startListeners.delete(begin);
    };
  }, [begin]);

  // The new route committed — drop the veil.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    end();
  }, [pathname, end]);

  useEffect(
    () => () => {
      clear(appearTimer);
      clear(hideTimer);
      clear(watchdog);
    },
    [clear]
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="nav-veil"
          ref={columnRef}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
          className="absolute inset-0 z-50"
          role="status"
          aria-label="Loading"
          aria-busy="true"
        >
          {/* During the entrance main can be transformed. Portal the veil to
              body so fixed positioning stays viewport-relative, and blur only
              the visible slice rather than a potentially very tall page. */}
          {mounted &&
            box &&
            createPortal(
              <motion.div
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
                className="pointer-events-none fixed z-[60] flex items-center justify-center bg-background/25 backdrop-blur-[3px] motion-reduce:backdrop-blur-none"
                style={{
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                }}
              >
                <motion.div
                  initial={reducedMotion ? false : blurIn.initial}
                  animate={blurIn.animate}
                  exit={reducedMotion ? undefined : blurIn.exit}
                  transition={reducedMotion ? { duration: 0 } : blurInTransition}
                >
                  <LoadingBar />
                </motion.div>
              </motion.div>,
              document.body
            )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
