"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { setTaskStatus } from "@/lib/actions/tasks";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type HubTask = {
  id: string;
  title: string;
  status: "To do" | "In progress" | "Done";
  due_date: string | null;
};

const MAX_ROWS = 5;

/**
 * Compact task list for the hub. Rows are tickable straight from the dashboard
 * — the write goes through the same `setTaskStatus` server action the tasks
 * page uses, and the local list updates first so the checkbox never lags
 * behind the tap. On failure it rolls back, matching the tracks view's
 * snapshot-then-write pattern.
 */
export function TasksPanel({ tasks }: { tasks: HubTask[] }) {
  const [rows, setRows] = React.useState(tasks);
  const [busy, setBusy] = React.useState<Set<string>>(() => new Set());

  // Re-sync when the server sends a fresh list, but never clobber a row the
  // user is mid-toggle on.
  React.useEffect(() => setRows(tasks), [tasks]);

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
    if (next === "Done") haptics.success();
    else haptics.tap();
  };

  const open = rows.filter((t) => t.status !== "Done").slice(0, MAX_ROWS);
  const doneCount = rows.filter((t) => t.status === "Done").length;
  const hidden = rows.filter((t) => t.status !== "Done").length - open.length;

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

      {open.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground/70">
          Nothing open. Nice.
        </p>
      ) : (
        <ul>
          {open.map((task, i) => (
            <motion.li
              key={task.id}
              layout
              initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
              animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
              transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.04, ease: "easeOut" }}
              className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={false}
                aria-label={`Mark "${task.title}" done`}
                disabled={busy.has(task.id)}
                onClick={() => toggle(task)}
                className="flex h-11 w-11 shrink-0 items-center justify-center -ml-3 disabled:opacity-50"
              >
                <span
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white/25 transition-colors hover:border-white/50"
                  aria-hidden
                />
              </button>

              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {task.title}
              </span>

              {task.due_date && <CountdownPill date={task.due_date} />}
            </motion.li>
          ))}
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