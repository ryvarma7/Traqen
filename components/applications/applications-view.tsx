"use client";

import * as React from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  ArrowUpDown,
  Briefcase,
  ChevronDown,
  ExternalLink,
  Pencil,
  Plus,
  StickyNote,
  Trophy,
} from "lucide-react";
import { HackathonForm } from "@/components/applications/hackathon-form";
import { JobForm } from "@/components/applications/job-form";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { FormSheet } from "@/components/shared/form-sheet";
import { NotesInline } from "@/components/shared/notes-inline";
import { PriorityPill } from "@/components/shared/priority-pill";
import { StatusPill } from "@/components/shared/status-pill";
import { Select } from "@/components/ui/select";
import {
  saveHackathonNotes,
  saveJobApplicationNotes,
} from "@/lib/actions/applications";
import { daysUntil } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DropdownOption, Hackathon, JobApplication } from "@/lib/types";

type Tab = "jobs" | "hackathons";
type SortKey = "name" | "status" | "deadline";

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export function ApplicationsView({
  jobs,
  hackathons,
  dropdownOptions,
}: {
  jobs: JobApplication[];
  hackathons: Hackathon[];
  dropdownOptions: DropdownOption[];
}) {
  const [tab, setTab] = React.useState<Tab>("jobs");
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [sortKey, setSortKey] = React.useState<SortKey>("deadline");
  const [sortAsc, setSortAsc] = React.useState(true);
  const [sheet, setSheet] = React.useState<{ open: boolean; editing: string | null }>({
    open: false,
    editing: null,
  });
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const section = tab === "jobs" ? "jobs" : "hackathons";
  const customOptions = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const option of dropdownOptions) {
      if (option.section !== section) continue;
      (map[option.field_name] ??= []).push(option.value);
    }
    return map;
  }, [dropdownOptions, section]);

  const statuses = React.useMemo(
    () =>
      tab === "jobs"
        ? Array.from(new Set(jobs.map((j) => j.status)))
        : Array.from(new Set(hackathons.map((h) => h.status))),
    [tab, jobs, hackathons]
  );

  const rows = React.useMemo(() => {
    const name = (r: JobApplication | Hackathon) =>
      "company" in r ? r.company : r.hackathon_name;

    let list: (JobApplication | Hackathon)[] =
      tab === "jobs" ? [...jobs] : [...hackathons];
    if (statusFilter !== "All") list = list.filter((r) => r.status === statusFilter);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = name(a).localeCompare(name(b));
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else {
        const da = a.deadline ? daysUntil(a.deadline) : Infinity;
        const db = b.deadline ? daysUntil(b.deadline) : Infinity;
        cmp = da - db;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [tab, jobs, hackathons, statusFilter, sortKey, sortAsc]);

  const editingJob = jobs.find((j) => j.id === sheet.editing) ?? null;
  const editingHackathon = hackathons.find((h) => h.id === sheet.editing) ?? null;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const closeSheet = () => {
    setSheet({ open: false, editing: null });
    setExpandedId(null);
  };

  /** Notes-only save routed to the right table for this row. */
  const saveNotesFor =
    (row: JobApplication | Hackathon) =>
    (notes: string): Promise<{ error?: string }> =>
      "company" in row
        ? saveJobApplicationNotes(row.id, notes)
        : saveHackathonNotes(row.id, notes);

  const EmptyIcon = tab === "jobs" ? Briefcase : Trophy;
  const noun = tab === "jobs" ? "job application" : "hackathon";

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Segmented control */}
        <div className="inline-flex w-fit rounded-field border border-border bg-muted/50 p-1">
          {(["jobs", "hackathons"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setStatusFilter("All");
              }}
              className={cn(
                "relative rounded-[7px] px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === t && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-[7px] glass-tile"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative z-10">{t}</span>
            </button>
          ))}
        </div>

        <div className="w-full md:w-44">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          Icon={EmptyIcon}
          message={
            statusFilter === "All"
              ? `No ${noun}s yet. Add your first one.`
              : `Nothing with status "${statusFilter}".`
          }
          onAdd={() => setSheet({ open: true, editing: null })}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-card glass-section md:block">
            <div className="overflow-x-auto">
              <motion.table
                key={tab}
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="w-full min-w-[720px] border-separate border-spacing-0"
              >
                <thead className="border-b border-border bg-muted/60">
                  <tr>
                    <SortableHeader label={tab === "jobs" ? "Company" : "Hackathon"} active={sortKey === "name"} onClick={() => toggleSort("name")} />
                    <SortableHeader label="Status" active={sortKey === "status"} onClick={() => toggleSort("status")} />
                    <th className="px-3.5 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">Priority</th>
                    <SortableHeader label="Deadline" active={sortKey === "deadline"} onClick={() => toggleSort("deadline")} />
                    <th className="px-3.5 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">Follow-up</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isJob = "company" in row;
                    const expanded = expandedId === row.id;
                    const name = isJob ? row.company : row.hackathon_name;
                    const subtitleBits = isJob
                      ? [row.role_type, row.location_mode, row.source]
                      : [row.organizing_company, row.mode, row.type];
                    const subtitle = subtitleBits.filter(Boolean).join(" · ");
                    return (
                      <React.Fragment key={row.id}>
                        <motion.tr
                          variants={itemVariants}
                          className="group cursor-pointer transition-colors"
                          onClick={() => setExpandedId(expanded ? null : row.id)}
                        >
                          <td className="border-b border-border px-3.5 py-3 text-sm font-medium text-foreground group-hover:bg-muted/50">
                            {name}
                            {subtitle && (
                              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                {subtitle}
                              </span>
                            )}
                          </td>
                          <td className="border-b border-border px-3.5 py-3 group-hover:bg-muted/50">
                            <StatusPill status={row.status} />
                          </td>
                          <td className="border-b border-border px-3.5 py-3 group-hover:bg-muted/50">
                            <PriorityPill priority={row.priority} />
                          </td>
                          <td className="border-b border-border px-3.5 py-3 group-hover:bg-muted/50">
                            {row.deadline ? (
                              <CountdownPill date={row.deadline} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="border-b border-border px-3.5 py-3 group-hover:bg-muted/50">
                            {row.follow_up_date ? (
                              <CountdownPill date={row.follow_up_date} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="border-b border-border px-2.5 py-3 text-right group-hover:bg-muted/50">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                aria-label="Edit"
                                className="glass-btn-base glass-btn-ghost rounded-field p-1.5 text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSheet({ open: true, editing: row.id });
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform",
                                  expanded && "rotate-180"
                                )}
                              />
                            </div>
                          </td>
                        </motion.tr>
                        {expanded && (
                          <tr>
                            <td colSpan={6} className="border-b border-border bg-muted/40 px-4 py-4 align-top">
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className="grid gap-6 md:grid-cols-2"
                              >
                                <div>
                                  <DetailGrid row={row} />
                                  <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    type="button"
                                    className="glass-btn-base glass-btn-outline mt-4 h-9 gap-2 rounded-field px-3.5 text-sm font-medium text-foreground"
                                    onClick={() => setSheet({ open: true, editing: row.id })}
                                  >
                                    <Pencil className="h-3.5 w-3.5" /> Edit full details
                                  </motion.button>
                                </div>
                                <NotesSection notes={row.notes} onSave={saveNotesFor(row)} />
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </motion.table>
            </div>
          </div>

          {/* Mobile card stack */}
          <motion.div
            key={`${tab}-cards`}
            variants={listVariants}
            initial="hidden"
            animate="visible"
            className="space-y-2.5 md:hidden"
          >
            {rows.map((row) => {
              const isJob = "company" in row;
              const expanded = expandedId === row.id;
              const name = isJob ? row.company : row.hackathon_name;
              return (
                <motion.div
                  key={row.id}
                  variants={itemVariants}
                  className="rounded-card glass-tile glass-tile-hover overflow-hidden"
                >
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left"
                    onClick={() => setExpandedId(expanded ? null : row.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{name}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusPill status={row.status} />
                        <PriorityPill priority={row.priority} />
                        {row.deadline && <CountdownPill date={row.deadline} />}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        expanded && "rotate-180"
                      )}
                    />
                  </button>
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border bg-muted/40 px-4 py-4 space-y-4">
                          <DetailGrid row={row} />
                          <NotesSection notes={row.notes} onSave={saveNotesFor(row)} />
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            type="button"
                            className="glass-btn-base glass-btn-outline flex h-10 w-full items-center justify-center gap-2 rounded-field text-sm font-medium text-foreground"
                            onClick={() => setSheet({ open: true, editing: row.id })}
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        </>
      )}

      {/* Floating add button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        type="button"
        aria-label={`Add ${noun}`}
        onClick={() => setSheet({ open: true, editing: null })}
        className="glass-btn-base glass-btn-primary fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      <FormSheet
        open={sheet.open}
        onClose={closeSheet}
        title={
          sheet.editing
            ? `Edit ${noun}`
            : `Add ${noun}`
        }
      >
        {tab === "jobs" ? (
          <JobForm
            item={editingJob}
            customOptions={customOptions}
            onClose={closeSheet}
          />
        ) : (
          <HackathonForm
            item={editingHackathon}
            customOptions={customOptions}
            onClose={closeSheet}
          />
        )}
      </FormSheet>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-3.5 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground font-semibold"
        )}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}

/** Notes section with styled header — used inside expanded rows. */
function NotesSection({
  notes,
  onSave,
}: {
  notes: string | null;
  onSave: (notes: string) => Promise<{ error?: string }>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <StickyNote className="h-3.5 w-3.5 text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notes
        </h3>
      </div>
      <NotesInline notes={notes} onSave={onSave} />
    </div>
  );
}

/** Shared detail fields for the mobile cards and the desktop expanded row. */
function DetailGrid({ row }: { row: JobApplication | Hackathon }) {
  const entries: [string, string][] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value) entries.push([label, value]);
  };

  if ("company" in row) {
    // Job application fields
    push("Role type",  row.role_type);
    push("Stage",      row.stage_detail);
    push("Location",   row.location_mode);
    push("Source",     row.source);
    push("Contact",    row.contact_person);
    push("Applied",    row.applied_date);
    push("Follow-up",  row.follow_up_date);
    push("Start",      row.start_date);
    push("End",        row.end_date);
  } else {
    // Hackathon fields — comprehensive
    push("Organizer",    row.organizing_company);
    push("Type",         row.type);
    push("Purpose",      row.purpose);
    push("Theme/Track",  row.theme_track);
    push("Track detail", row.track_details);
    push("Mode",         row.mode);
    push("Team size",    row.team_size ? String(row.team_size) : null);
    push("Team members", row.team_members);
    push("Status",       row.status);
    push("Round",        row.round_detail);
    push("Result",       row.result_rank);
    push("Source",       row.source);
    push("Applied",      row.applied_date);
    push("Follow-up",    row.follow_up_date);
    push("Start",        row.start_date);
    push("End",          row.end_date);
  }

  const link = row.application_link;
  const projectLink = !("company" in row) ? row.project_link : null;

  if (entries.length === 0 && !link && !projectLink)
    return <p className="text-xs text-muted-foreground">No extra details.</p>;

  return (
    <dl className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex gap-2 text-xs">
          <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
          <dd className="min-w-0 flex-1 break-words font-medium text-foreground">{value}</dd>
        </div>
      ))}
      {link && (
        <div className="flex gap-2 text-xs">
          <dt className="w-24 shrink-0 text-muted-foreground">App link</dt>
          <dd className="min-w-0 flex-1">
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex max-w-full items-center gap-1 text-accent underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{link.replace(/^https?:\/\//, "")}</span>
            </a>
          </dd>
        </div>
      )}
      {projectLink && (
        <div className="flex gap-2 text-xs">
          <dt className="w-24 shrink-0 text-muted-foreground">Project</dt>
          <dd className="min-w-0 flex-1">
            <a
              href={projectLink}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex max-w-full items-center gap-1 text-accent underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{projectLink.replace(/^https?:\/\//, "")}</span>
            </a>
          </dd>
        </div>
      )}
    </dl>
  );
}

function EmptyState({
  Icon,
  message,
  onAdd,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  message: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-card glass-section border-dashed px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-field border border-border bg-surface">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </span>
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={onAdd}
        className="glass-btn-base glass-btn-primary mt-4 h-10 gap-2 rounded-field px-4 text-sm"
      >
        <Plus className="h-4 w-4" /> Add one
      </motion.button>
    </div>
  );
}