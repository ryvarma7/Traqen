"use client";

import * as React from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ChevronDown, Link2, Pencil, Plus, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { FormSheet } from "@/components/shared/form-sheet";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { PriorityPill } from "@/components/shared/priority-pill";
import { TaskForm, type LinkableItem } from "@/components/tasks/task-form";
import { setTaskStatus } from "@/lib/actions/tasks";
import { TASK_STATUSES, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export function TasksView({
  tasks,
  linkables,
}: {
  tasks: Task[];
  linkables: LinkableItem[];
}) {
  const [sheet, setSheet] = React.useState<{ open: boolean; editing: string | null; preset: string }>({
    open: false,
    editing: null,
    preset: "To do",
  });
  const [openSection, setOpenSection] = React.useState<string | null>("To do");

  const linkLabel = React.useMemo(() => {
    const map = new Map(linkables.map((l) => [l.id, l.label]));
    return (task: Task) =>
      task.related_id ? map.get(task.related_id) ?? null : null;
  }, [linkables]);

  const editing = tasks.find((t) => t.id === sheet.editing) ?? null;

  const closeSheet = () =>
    setSheet({ open: false, editing: null, preset: "To do" });

  const moveTask = async (task: Task, status: Task["status"]) => {
    const result = await setTaskStatus(task.id, status);
    if (result.error) toast.error(result.error);
  };

  const empty = tasks.length === 0;

  return (
    <div>
      {empty ? (
        <div className="flex flex-col items-center rounded-card glass-section border-dashed px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            No tasks yet. Add your first one.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => setSheet({ open: true, editing: null, preset: "To do" })}
            className="mt-4 glass-btn-base glass-btn-primary h-10 gap-2 rounded-field px-4 text-sm"
          >
            <Plus className="h-4 w-4" /> Add task
          </motion.button>
        </div>
      ) : (
        <>
          {/* Desktop: Kanban columns */}
          <div className="hidden gap-4 md:grid md:grid-cols-3">
            {TASK_STATUSES.map((status) => {
              const group = tasks.filter((t) => t.status === status);
              return (
                <section key={status} className="flex flex-col">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {status}
                    </h2>
                    <span className="flex h-5 items-center rounded-full border border-border bg-surface px-2 font-mono text-2xs font-semibold tabular-nums text-foreground/80">
                      {group.length}
                    </span>
                  </div>
                  <motion.div
                    variants={listVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-2.5"
                  >
                    {group.map((task) => (
                      <motion.div
                        key={task.id}
                        variants={itemVariants}
                        className="rounded-card glass-tile glass-tile-hover p-3.5"
                      >
                        <TaskCardBody task={task} linked={linkLabel(task)} onEdit={() => setSheet({ open: true, editing: task.id, preset: task.status })} />
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {TASK_STATUSES.filter((s) => s !== status).map((s) => (
                            <motion.button
                              key={s}
                              whileTap={{ scale: 0.97 }}
                              type="button"
                              onClick={() => moveTask(task, s)}
                              className="glass-btn-base glass-btn-outline rounded-full px-2.5 py-0.5 text-2xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              → {s}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                    {group.length === 0 && (
                      <div className="rounded-card glass-section border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
                        Nothing here
                      </div>
                    )}
                  </motion.div>
                </section>
              );
            })}
          </div>

          {/* Mobile: collapsible accordions per status */}
          <div className="space-y-3 md:hidden">
            {TASK_STATUSES.map((status) => {
              const group = tasks.filter((t) => t.status === status);
              const isOpen = openSection === status;
              return (
                <section key={status} className="rounded-card glass-section overflow-hidden">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between px-4 py-3"
                    onClick={() => setOpenSection(isOpen ? null : status)}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {status}
                      <span className="flex h-5 items-center rounded-full border border-border bg-surface px-2 font-mono text-2xs font-semibold tabular-nums text-foreground/80">
                        {group.length}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2.5 border-t border-border p-3">
                          {group.map((task) => (
                            <div key={task.id} className="rounded-field glass-tile p-3">
                              <TaskCardBody
                                task={task}
                                linked={linkLabel(task)}
                                onEdit={() => setSheet({ open: true, editing: task.id, preset: task.status })}
                              />
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {TASK_STATUSES.filter((s) => s !== status).map((s) => (
                                  <motion.button
                                    key={s}
                                    whileTap={{ scale: 0.97 }}
                                    type="button"
                                    onClick={() => moveTask(task, s)}
                                    className="glass-btn-base glass-btn-outline h-8 rounded-full px-3 text-2xs font-medium text-muted-foreground"
                                  >
                                    → {s}
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {group.length === 0 && (
                            <p className="px-1 py-2 text-center text-xs text-muted-foreground">
                              Nothing here
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              );
            })}
          </div>
        </>
      )}

      {/* Floating add button with glowing Framer glass aesthetic */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        type="button"
        aria-label="Add task"
        onClick={() => setSheet({ open: true, editing: null, preset: "To do" })}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full glass-btn-base glass-btn-primary shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      <FormSheet
        open={sheet.open}
        onClose={closeSheet}
        title={sheet.editing ? "Edit task" : "Add task"}
      >
        <TaskForm
          item={editing ?? (sheet.open ? ({ status: sheet.preset } as Task) : null)}
          linkables={linkables}
          onClose={closeSheet}
        />
      </FormSheet>
    </div>
  );
}

function TaskCardBody({
  task,
  linked,
  onEdit,
}: {
  task: Task;
  linked: string | null;
  onEdit: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">
          {task.title}
        </p>
        <button
          type="button"
          aria-label="Edit task"
          onClick={onEdit}
          className="shrink-0 rounded-field p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}
      {task.notes && (
        <p className="mt-1.5 flex items-start gap-1.5 border-l-2 border-accent/40 pl-2 text-xs text-muted-foreground">
          <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">{task.notes}</span>
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityPill priority={task.priority} />
        {task.due_date && <CountdownPill date={task.due_date} />}
        {linked && (
          <span className="inline-flex max-w-40 items-center gap-1 truncate rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-2xs font-medium text-accent">
            <Link2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{linked}</span>
          </span>
        )}
        {task.category && (
          <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-2xs font-medium text-muted-foreground">
            {task.category}
          </span>
        )}
      </div>
    </div>
  );
}
