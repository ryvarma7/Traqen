"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { LoadingBar } from "@/components/shared/loading-bar";
import { setTaskStatus } from "@/lib/actions/tasks";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { useMotionPreferences } from "@/components/shared/motion-provider";
import { blurIn, listItemTransition } from "@/lib/motion";

export type HubTask = {
  id: string;
  title: string;
  status: "To do" | "In progress" | "Done";
  due_date: string | null;
};

const MAX_ROWS = 5;

/** How long a finished row stays put — struck through, with an Undo button —
 *  before the list closes the gap. Long enough to notice a mis-tap and take it
 *  back, short enough that the panel never feels clogged. */
const SETTLE_MS = 6000;

/** One toast id per task, so undoing dismisses its own confirmation and leaves
 *  any other toast (an error, say) on screen. */
const toastId = (taskId: string) => `task-done-${taskId}`;

/**
 * Compact task list for the hub. Rows are tickable straight from the dashboard
 * — the write goes through the same `setTaskStatus` server action the tasks
 * page uses, and the local list updates first so the checkbox never lags
 * behind the tap. On failure it rolls back, matching the tracks view's
 * snapshot-then-write pattern.
 *
 * A completed row is NOT removed on the spot. It strikes through, offers Undo
 * in place and in a toast, and only collapses out of the list once the settle
 * window closes — completing something by accident is otherwise unrecoverable
 * from a list that deletes on click.
 */
export function TasksPanel({ tasks }: { tasks: HubTask[] }) {
  const reducedMotion = useMotionPreferences();
  const [rows, setRows] = React.useState(tasks);
  const [busy, setBusy] = React.useState<Set<string>>(() => new Set());
  /** Finished rows still inside their settle window — rendered, but held out
   *  of `open` so they don't push the remaining work down the panel. */
  const [settling, setSettling] = React.useState<Set<string>>(() => new Set());
  const settleTimers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // The re-sync effect below must read the current settle set without listing
  // it as a dependency — depending on it would re-run the merge on every tick
  // of the window and reorder the list under the user.
  const settlingRef = React.useRef(settling);
  settlingRef.current = settling;

  // Re-sync when the server sends a fresh list, but never clobber a row the
  // user is mid-toggle on — and never drop a row that is still inside its
  // settle window. The server's list no longer contains a just-completed task,
  // so a plain replace would delete the row mid-strike and the animation the
  // user is meant to see would never play.
  React.useEffect(() => {
    setRows((prev) => {
      const incoming = new Set(tasks.map((t) => t.id));
      const held = prev.filter(
        (t) => t.status === "Done" && settlingRef.current.has(t.id) && !incoming.has(t.id)
      );
      return held.length === 0 ? tasks : [...held, ...tasks];
    });
  }, [tasks]);

  // Timers outlive the component unless cleared — a pending setTimeout would
  // call setState on an unmounted panel.
  React.useEffect(() => {
    const timers = settleTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const startSettle = (id: string) => {
    setSettling((prev) => new Set(prev).add(id));
    const existing = settleTimers.current.get(id);
    if (existing) clearTimeout(existing);
    settleTimers.current.set(
      id,
      setTimeout(() => {
        settleTimers.current.delete(id);
        setSettling((prev) => {
          if (!prev.has(id)) return prev;
          const copy = new Set(prev);
          copy.delete(id);
          return copy;
        });
      }, SETTLE_MS)
    );
  };

  /** Drop the settle hold early so the row animates out right away. */
  const endSettle = (id: string) => {
    const timer = settleTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      settleTimers.current.delete(id);
    }
    setSettling((prev) => {
      if (!prev.has(id)) return prev;
      const copy = new Set(prev);
      copy.delete(id);
      return copy;
    });
  };

  const toggle = async (task: HubTask) => {
    if (busy.has(task.id)) return;
    const next = task.status === "Done" ? "To do" : "Done";
    const previous = rows;

    setRows((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))
    );
    setBusy((prev) => new Set(prev).add(task.id));

    const result = await setTaskStatus(task.id, next);
    setBusy((prev) => {
      const copy = new Set(prev);
      copy.delete(task.id);
      return copy;
    });

    if (result.error) {
      setRows(previous);
      haptics.error();
      toast.error(result.error);
      return;
    }

    if (next === "Done") {
      haptics.success();
      startSettle(task.id);
      toast("Task completed", {
        id: toastId(task.id),
        description: task.title,
        action: { label: "Undo", onClick: () => void undo(task) },
        duration: SETTLE_MS,
      });
    } else {
      haptics.tap();
      endSettle(task.id);
    }
  };

  /** Put a just-completed task back. Runs through the same action, so a
   *  failure here is reported rather than silently swallowed. */
  const undo = async (task: HubTask) => {
    endSettle(task.id);
    toast.dismiss(toastId(task.id));
    setRows((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "To do" } : t)));
    const result = await setTaskStatus(task.id, "To do");
    if (result.error) {
      haptics.error();
      toast.error(result.error);
      return;
    }
    haptics.tap();
  };

  // Open work only — settling rows are rendered separately below so a
  // just-finished task can't evict a live one from the list.
  const open = rows.filter((t) => t.status !== "Done" && !settling.has(t.id)).slice(0, MAX_ROWS);
  const settlingRows = rows.filter((t) => t.status === "Done" && settling.has(t.id));
  const doneCount = rows.filter((t) => t.status === "Done").length;
  const hidden = rows.filter((t) => t.status !== "Done" && !settling.has(t.id)).length - open.length;

  return (
    <section className="panel mb-4 px-4 pt-4 md:px-5" aria-label="Tasks">
      <header className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium tracking-tight text-foreground">
          Tasks
          {doneCount > 0 && (
            <span className="ml-2 text-2xs font-normal text-muted-foreground/70">
              {doneCount} done
            </span>
          )}
        </h2>
        <Link
          href="/tasks"
          className="text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          All tasks
        </Link>
      </header>

      {open.length === 0 && settlingRows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground/70">
          Nothing open. Nice.
        </p>
      ) : (
        <ul>
          <AnimatePresence initial={false}>
            {/* Settling rows sit at the end of the same list rather than in a
                second one, so the strike-through animates on the row the user
                actually tapped instead of a fresh row appearing below. */}
            {[...open, ...settlingRows].map((task, i) => {
              const done = task.status === "Done";
              return (
                <motion.li
                  key={task.id}
                  layout={reducedMotion ? false : "position"}
                  initial={reducedMotion ? false : blurIn.initial}
                  animate={blurIn.animate}
                  exit={reducedMotion ? { opacity: 0 } : blurIn.exit}
                  transition={reducedMotion ? { duration: 0 } : listItemTransition(i)}
                  className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0"
                >
                  <motion.button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
                    aria-busy={busy.has(task.id) || undefined}
                    disabled={busy.has(task.id)}
                    onClick={() => toggle(task)}
                    whileTap={{ scale: 0.9 }}
                    className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-50"
                  >
                    <motion.span
                      className="flex h-[18px] w-[18px] items-center justify-center rounded-full border"
                      animate={{
                        backgroundColor: done ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0)",
                        borderColor: done ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.25)",
                        scale: done ? [1, 1.25, 1] : 1,
                      }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      aria-hidden
                    >
                      {busy.has(task.id) ? (
                        <LoadingBar className="h-1 w-3.5" />
                      ) : (
                        <AnimatePresence>
                          {done && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.4 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.4 }}
                              transition={{ duration: 0.15, ease: "easeOut" }}
                            >
                              <Check className="h-3 w-3 text-black" strokeWidth={3.5} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      )}
                    </motion.span>
                  </motion.button>

                  <span className="relative min-w-0 flex-1">
                    <motion.span
                      className={cn(
                        "block truncate text-sm",
                        done ? "text-muted-foreground" : "text-foreground"
                      )}
                      animate={{ opacity: done ? 0.55 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {task.title}
                    </motion.span>
                    {/* The crossing-out line. Scales from the left edge so it
                        reads as a pen stroke rather than a state change. */}
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute left-0 top-1/2 h-px w-full origin-left bg-foreground/70"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: done ? 1 : 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </span>

                  {done ? (
                    <motion.button
                      type="button"
                      onClick={() => undo(task)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="shrink-0 rounded-field px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                    >
                      Undo
                    </motion.button>
                  ) : (
                    task.due_date && <CountdownPill date={task.due_date} className="shrink-0" />
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Faded ghost row — the reference's progressive-disclosure add affordance. */}
      <Link
        href="/tasks?create=1"
        className={cn(
          "flex items-center gap-3 border-t border-white/[0.06] py-2.5 text-muted-foreground/60",
          "transition-colors hover:text-muted-foreground"
        )}
      >
        <span className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="text-sm">Add task</span>
      </Link>

      {hidden > 0 && (
        <p className="pt-2 text-2xs text-muted-foreground/60">
          +{hidden} more open in{" "}
          <Link href="/tasks" className="underline underline-offset-2 hover:text-foreground">
            Tasks
          </Link>
        </p>
      )}
    </section>
  );
}
