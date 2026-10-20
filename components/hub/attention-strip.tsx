"use client";

import Link from "next/link";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ListChecks,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { CountdownPill } from "@/components/shared/countdown-pill";
import { PriorityPill } from "@/components/shared/priority-pill";
import { StatusPill } from "@/components/shared/status-pill";
import { daysUntil } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type AttentionGroup = "now" | "coming_up" | "needs_next_step";

export type AttentionDateRole = "deadline" | "follow_up" | "due";

/** One actionable item on the dashboard's catch-up queue. */
export type AttentionItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string | null;
  kind: string;
  status: string;
  priority: string | null;
  group: AttentionGroup;
  date: string | null;
  role: AttentionDateRole | null;
  action: string;
};

const GROUP_ORDER: AttentionGroup[] = ["now", "coming_up", "needs_next_step"];

const GROUP_META: Record<
  AttentionGroup,
  {
    label: string;
    mobileLabel: string;
    description: string;
    emptyMessage: string;
    icon: LucideIcon;
    tone: string;
  }
> = {
  now: {
    label: "Now",
    mobileLabel: "Now",
    description: "Overdue or due today",
    emptyMessage: "Nothing overdue or due today.",
    icon: AlertTriangle,
    tone: "text-danger",
  },
  coming_up: {
    label: "Coming up",
    mobileLabel: "Coming up",
    description: "The next 7 days",
    emptyMessage: "No work due in the next 7 days.",
    icon: CalendarDays,
    tone: "text-warning",
  },
  needs_next_step: {
    label: "Needs a next step",
    mobileLabel: "Next step",
    description: "Missing a date or plan",
    emptyMessage: "No items need a date or plan.",
    icon: CircleDot,
    tone: "text-muted-foreground",
  },
};

const KIND_ICON: Record<string, LucideIcon> = {
  Job: Briefcase,
  Hackathon: Trophy,
  Task: ListChecks,
  "Course step": BookOpen,
};

const ROLE_LABEL: Record<AttentionDateRole, string> = {
  deadline: "Deadline",
  follow_up: "Follow-up",
  due: "Due",
};

const INITIAL_MOBILE_VISIBLE = 3;

function temporalLabel(item: AttentionItem) {
  if (!item.date || !item.role) return "Needs a date";
  const days = daysUntil(item.date);
  if (days < 0) return item.role === "follow_up" ? "Late follow-up" : "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

function itemLabel(item: AttentionItem) {
  const temporal = temporalLabel(item);
  return item.role ? `${temporal} · ${ROLE_LABEL[item.role]}` : temporal;
}

export function AttentionStrip({
  items,
}: {
  items: AttentionItem[];
}) {
  const [mobileGroup, setMobileGroup] = React.useState<AttentionGroup | null>(null);
  const [mobileExpanded, setMobileExpanded] = React.useState<Partial<Record<AttentionGroup, boolean>>>({});
  const queueId = React.useId();
  const grouped = GROUP_ORDER.reduce<Record<AttentionGroup, AttentionItem[]>>(
    (result, group) => {
      result[group] = items.filter((item) => item.group === group);
      return result;
    },
    { now: [], coming_up: [], needs_next_step: [] }
  );
  const emptyGroups = GROUP_ORDER.filter((group) => grouped[group].length === 0);
  const urgent = grouped.now.length;
  const selectedGroup = mobileGroup ?? GROUP_ORDER.find((group) => grouped[group].length > 0) ?? "now";

  if (items.length === 0) {
    return (
      <section aria-label="Needs attention" className="panel mb-4 px-4 py-4 md:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft/80 text-success">
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">You&apos;re clear</h2>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              No overdue work, upcoming deadlines, or missing next steps.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Needs attention" className="panel mb-4 min-w-0 px-4 py-3.5 md:px-5">
      <header className="mb-3 flex items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-4 rounded-full bg-foreground" aria-hidden />
            <h2 className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
              Needs attention
            </h2>
          </div>
          <p className="mt-1 hidden text-2xs text-muted-foreground/70 md:block">
            {urgent > 0 && <span className="text-danger">{urgent} now · </span>}
            {grouped.coming_up.length} coming up · {grouped.needs_next_step.length} need a next step
          </p>
        </div>
      </header>

      <div role="group" aria-label="Attention groups" className="mb-3 grid grid-cols-3 gap-2 md:hidden">
        {GROUP_ORDER.map((group) => (
          <button
            key={group}
            type="button"
            aria-pressed={selectedGroup === group}
            aria-controls={`${queueId}-${group}`}
            onClick={() => setMobileGroup(group)}
            className={cn(
              "focus-ring flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-field px-1 py-2 text-2xs font-medium transition-colors hover:bg-accent-subtle hover:text-foreground",
              selectedGroup === group
                ? "bg-accent-subtle text-foreground"
                : "bg-surface text-muted-foreground"
            )}
          >
            <span>{GROUP_META[group].mobileLabel}</span>
            <span className="font-mono tabular-nums text-muted-foreground">{grouped[group].length}</span>
          </button>
        ))}
      </div>

      <div className="min-w-0 md:flex md:flex-col md:gap-5">
        {GROUP_ORDER.map((group, groupIndex) => (
          <AttentionLane
            key={group}
            group={group}
            groupIndex={groupIndex}
            items={grouped[group]}
            id={`${queueId}-${group}`}
            selected={selectedGroup === group}
            mobileExpanded={!!mobileExpanded[group]}
            onMobileToggle={() => setMobileExpanded((value) => ({ ...value, [group]: !value[group] }))}
          />
        ))}
      </div>

      {emptyGroups.length > 0 && (
        <div aria-label="Clear attention groups" className="mt-3 hidden flex-wrap items-center gap-x-4 gap-y-2 md:flex">
          {emptyGroups.map((group) => (
            <span key={group} title={GROUP_META[group].emptyMessage} className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
              {GROUP_META[group].label} · All clear
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** One shared group: the existing mobile stack becomes a horizontal lane on desktop. */
function AttentionLane({
  group, groupIndex, items, id, selected, mobileExpanded, onMobileToggle,
}: {
  group: AttentionGroup;
  groupIndex: number;
  items: AttentionItem[];
  id: string;
  selected: boolean;
  mobileExpanded: boolean;
  onMobileToggle: () => void;
}) {
  const meta = GROUP_META[group];
  const Icon = meta.icon;
  const listRef = React.useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion();
  const [edges, setEdges] = React.useState({ previous: false, next: false });
  const mobileLimit = mobileExpanded ? items.length : INITIAL_MOBILE_VISIBLE;

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const updateEdges = () => {
      const previous = list.scrollLeft > 1;
      const next = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
      setEdges((value) => value.previous === previous && value.next === next ? value : { previous, next });
    };

    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(list);
    list.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      list.removeEventListener("scroll", updateEdges);
    };
  }, [items.length]);

  const move = (direction: -1 | 1) => {
    const list = listRef.current;
    const firstCard = list?.firstElementChild;
    if (!list || !firstCard) return;
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const step = firstCard.getBoundingClientRect().width + gap;
    const pageSize = Math.max(1, Math.floor((list.clientWidth + gap) / step));
    list.scrollBy({ left: direction * step * pageSize, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn(
        "min-w-0",
        !selected && "hidden",
        items.length > 0 ? "md:block" : "md:hidden"
      )}
    >
      <header className="mb-2.5 flex items-start gap-2 md:mb-2 md:items-center">
        <Icon className={cn("mt-0.5 hidden h-3.5 w-3.5 shrink-0 md:block", meta.tone)} strokeWidth={1.9} aria-hidden />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 id={`${id}-heading`} className="sr-only text-xs font-semibold text-foreground md:not-sr-only">
              {meta.label}
            </h3>
            <span className="hidden font-mono text-2xs tabular-nums text-muted-foreground md:inline">
              {items.length}
            </span>
          </div>
          <p className="mt-0.5 text-2xs text-muted-foreground">{meta.description}</p>
        </div>
        {items.length > 0 && (
          <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
            <button
              type="button"
              aria-label={`Previous ${meta.label} items`}
              aria-controls={`${id}-list`}
              disabled={!edges.previous}
              onClick={() => move(-1)}
              className="focus-ring flex h-11 w-11 items-center justify-center rounded-field bg-surface text-muted-foreground transition-colors hover:bg-accent-subtle hover:text-foreground disabled:cursor-default disabled:opacity-30 disabled:hover:bg-surface disabled:hover:text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Next ${meta.label} items`}
              aria-controls={`${id}-list`}
              disabled={!edges.next}
              onClick={() => move(1)}
              className="focus-ring flex h-11 w-11 items-center justify-center rounded-field bg-surface text-muted-foreground transition-colors hover:bg-accent-subtle hover:text-foreground disabled:cursor-default disabled:opacity-30 disabled:hover:bg-surface disabled:hover:text-muted-foreground"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </button>
          </div>
        )}
      </header>

      {items.length === 0 ? (
        <p className="rounded-field bg-surface px-3 py-4 text-xs text-muted-foreground">
          {meta.emptyMessage}
        </p>
      ) : (
        <ul
          ref={listRef}
          id={`${id}-list`}
          aria-label={`${meta.label} items`}
          className="no-scrollbar min-w-0 space-y-2 md:-m-1 md:flex md:snap-x md:snap-mandatory md:scroll-px-1 md:gap-3 md:space-y-0 md:overflow-x-auto md:overscroll-x-contain md:p-1"
        >
          {items.map((item, itemIndex) => (
            <AttentionCard
              key={item.id}
              item={item}
              index={groupIndex * 3 + itemIndex}
              className={cn(
                itemIndex >= mobileLimit && "hidden",
                "md:list-item md:w-72 md:max-w-full md:shrink-0 md:snap-start xl:w-[calc((100%-1.5rem)/3)] xl:min-w-72"
              )}
            />
          ))}
        </ul>
      )}

      {items.length > INITIAL_MOBILE_VISIBLE && (
        <button
          type="button"
          aria-expanded={mobileExpanded}
          aria-controls={`${id}-list`}
          aria-label={`${mobileExpanded ? "Show fewer" : "Show more"} ${meta.mobileLabel} items`}
          onClick={onMobileToggle}
          className="focus-ring mt-2 min-h-11 w-full rounded-field bg-surface px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent-subtle hover:text-foreground md:hidden"
        >
          {mobileExpanded ? "Show less" : `Show ${items.length - INITIAL_MOBILE_VISIBLE} more`}
        </button>
      )}
    </section>
  );
}

function AttentionCard({ item, index, className }: { item: AttentionItem; index: number; className?: string }) {
  const Icon = KIND_ICON[item.kind] ?? CircleDot;
  const reduceMotion = useReducedMotion();
  const datePill = item.date ? (
    <CountdownPill date={item.date} role={item.role ?? undefined} className="shrink-0" />
  ) : (
    <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-2xs text-muted-foreground">
      No date
    </span>
  );

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, filter: "blur(8px)", scale: 0.98 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.25, delay: reduceMotion ? 0 : Math.min(index, 8) * 0.04, ease: "easeOut" }}
      className={cn("min-w-0", className)}
    >
      <Link
        href={item.href}
        className="group block min-w-0 rounded-field bg-surface px-3 py-3 transition-colors hover:bg-card-hover focus-ring md:border md:border-white/10 md:bg-card md:py-2.5 md:hover:border-white/20"
      >
        <div className="hidden items-center justify-between gap-2 md:flex">
          <span className="flex min-w-0 items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
            <Icon className="h-3 w-3 shrink-0" strokeWidth={1.8} aria-hidden />
            <span className="truncate">{itemLabel(item)}</span>
          </span>
          {datePill}
        </div>

        <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere] md:mt-2 md:truncate">{item.title}</p>
        <p className="mt-0.5 text-2xs text-muted-foreground [overflow-wrap:anywhere] md:truncate">
          {item.kind}
          {item.subtitle ? ` · ${item.subtitle}` : ""}
        </p>

        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2 md:flex md:items-center md:gap-1.5">
          <span className="min-w-0 text-sm font-medium text-foreground [overflow-wrap:anywhere] md:flex-1 md:truncate md:text-2xs md:text-foreground/80">
            {item.action}
          </span>
          <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-1.5 md:contents">
            <span className="inline-flex max-w-full flex-wrap items-center gap-1.5 md:hidden">
              {item.date && item.role && (
                <span className="text-2xs text-muted-foreground">{ROLE_LABEL[item.role]}</span>
              )}
              {datePill}
            </span>
            {item.priority && item.priority !== "Low" && (
              <PriorityPill priority={item.priority} className="min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere] md:shrink-0 md:whitespace-nowrap" />
            )}
            {item.status && (
              <StatusPill status={item.status} className="min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere] md:shrink-0 md:whitespace-nowrap" />
            )}
          </div>
          <ArrowRight
            className="col-start-2 row-start-1 mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transform-none motion-reduce:transition-none md:mt-0"
            strokeWidth={1.8}
            aria-hidden
          />
        </div>
      </Link>
    </motion.li>
  );
}
