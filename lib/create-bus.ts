"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Tiny bus that lets the floating mobile tab bar's "+" open whichever create
 * sheet the current page already owns.
 *
 * Each page's create form lives in local state deep inside its view component
 * (TasksView holds `sheet.open`, NotesView holds its own, and so on). Lifting
 * that state into the shell would mean rewriting every view's props and
 * threading the sheet back down — a lot of churn for one button. Instead the
 * bar broadcasts an intent and each view subscribes, so the exact same
 * `openNew()` that the old floating "+" button called is what fires now.
 */
const CREATE_EVENT = "traqen:create";

/** Broadcast "the user asked to create something on this page". */
export function requestCreate() {
  window.dispatchEvent(new Event(CREATE_EVENT));
}

/**
 * Run `handler` when the shell's "+" is tapped. Views that have nothing to
 * create simply don't call this, and the button hides itself on those routes.
 *
 * The handler is held in a ref so a view can pass an inline arrow function
 * without re-subscribing on every render.
 */
export function useCreateShortcut(handler: () => void) {
  const ref = React.useRef(handler);
  ref.current = handler;

  React.useEffect(() => {
    const onCreate = () => ref.current();
    window.addEventListener(CREATE_EVENT, onCreate);
    return () => window.removeEventListener(CREATE_EVENT, onCreate);
  }, []);
}

/**
 * Same as `useCreateShortcut`, but for create sheets on *another* route.
 *
 * The hub's quick-action pills link to e.g. `/tasks?create=1` rather than
 * holding that page's form state. This fires `handler` once on arrival and
 * then strips the param, so a refresh doesn't reopen a blank form and the
 * back button doesn't replay it.
 */
export function usePendingCreate(handler: () => void) {
  const ref = React.useRef(handler);
  ref.current = handler;

  const router = useRouter();
  const searchParams = useSearchParams();
  const pending = searchParams.get("create") === "1";

  React.useEffect(() => {
    if (!pending) return;
    ref.current();
    // Drop only the `create` key, preserving anything else in the query, so a
    // refresh doesn't reopen a blank form and Back doesn't replay it.
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("create");
    const query = rest.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }, [pending, router, searchParams]);
}