import { redirect } from "next/navigation";
import { ApplicationsPanel, type HubApplication } from "@/components/hub/applications-panel";
import {
  AttentionStrip,
  type AttentionDate,
  type AttentionItem,
} from "@/components/hub/attention-strip";
import { CalendarTimeline } from "@/components/hub/calendar-timeline";
import { HubHeader } from "@/components/hub/hub-header";
import { NameEntryGate } from "@/components/hub/name-entry-gate";
import { NotesCarousel, type NotePreview } from "@/components/hub/notes-carousel";
import { TasksPanel, type HubTask } from "@/components/hub/tasks-panel";
import { PageTransition } from "@/components/shell/page-transition";
import { PostLoginLoader } from "@/components/shell/post-login-loader";
import { buildCalendarEvents, groupByDate } from "@/lib/calendar";
import { daysUntil } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_HACKATHON_STATUSES,
  ACTIVE_JOB_STATUSES,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/** Chip captions, keyed by the role that drives the countdown wording. */
const DATE_LABEL: Record<AttentionDate["role"], string> = {
  deadline: "Deadline",
  follow_up: "Follow-up",
  due: "Due",
};

const GREETINGS = [
  "What's on track",
  "What's next",
  "How's the progress",
  "Where are we at",
  "What's the plan",
  "How's everything going",
  "What are we working on",
  "What are we tracking",
  "Ready to track",
  "Ready to make progress",
  "Let's check in",
  "Let's see the progress",
  "How's it going",
  "What's happening",
  "What are we building",
  "How are we doing",
  "Where are we with things",
  "Let's get on track",
  "Back to tracking",
  "Ready for a quick check in",
  "How's your day going",
  "What's on your plate",
  "What are we getting done",
  "What's your focus today",
  "What are you up to",
  "What's the move",
  "What's happening today",
  "Where should we start",
  "What's your goal today",
  "What are we tackling today",
];

export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ justSignedIn?: string | string[] }>;
}) {
  const { justSignedIn } = await searchParams;
  const supabase = await createClient();

  // Auth check runs in parallel with the reads — the queries don't need
  // user.id because RLS already scopes every table to auth.uid().
  const [
    userRes,
    profileRes,
    jobsRes,
    hackathonsRes,
    tasksRes,
    notesRes,
    tracksRes,
    trackItemsRes,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("username, preferences").single(),
    supabase
      .from("job_applications")
      .select("id, company, role_type, status, deadline, follow_up_date"),
    supabase
      .from("hackathons")
      .select("id, hackathon_name, round_detail, status, start_date, deadline, follow_up_date"),
    supabase.from("tasks").select("id, title, status, due_date"),
    supabase
      .from("notes")
      .select("id, title, content, color, pinned, updated_at")
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase.from("learning_tracks").select("id, title, status"),
    supabase.from("track_items").select("id, track_id, title, status, target_date"),
  ]);

  if (!userRes.data.user) redirect("/login");

  const profileUsername = profileRes.data?.username;
  const preferences = profileRes.data?.preferences ?? {};
  // Ask for a name only when none is present, or the user has never entered
  // one — the username auto-derived from the Google email on first sign-in
  // doesn't count as entered.
  const hasEnteredName =
    Boolean(profileUsername) && preferences.name_set === true;
  const needsName = !hasEnteredName;
  const username = profileUsername ?? "there";

  const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

  const jobs = jobsRes.data ?? [];
  const hackathons = hackathonsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const notes = (notesRes.data ?? []) as NotePreview[];
  const tracks = tracksRes.data ?? [];
  const trackItems = trackItemsRes.data ?? [];
  const trackTitles = new Map(tracks.map((t) => [t.id, t.title]));

  // ── Needs attention ──────────────────────────────────────────────────────
  // One entry per entity, not per date: a company carrying both a deadline and
  // a follow-up is a single card with two chips. Only dates that still matter
  // for the row's current status are kept — a deadline is history once you've
  // applied, and a rejected or withdrawn row is dropped entirely — so the
  // strip is a triage list instead of a mirror of every date column.
  const HORIZON_DAYS = 14;
  const candidates: AttentionItem[] = [];

  const add = (
    id: string,
    href: string,
    title: string,
    subtitle: string | null,
    kind: string,
    status: string,
    dates: Omit<AttentionDate, "label">[]
  ) => {
    const within = dates.filter(
      (d) => d.date !== null && daysUntil(d.date) <= HORIZON_DAYS
    );
    if (within.length === 0) return;
    const labelled: AttentionDate[] = within.map((d) => ({
      ...d,
      label: DATE_LABEL[d.role],
    }));
    const earliest = labelled.reduce((min, d) => (d.date < min ? d.date : min), labelled[0].date);
    candidates.push({ id, href, title, subtitle, kind, status, dates: labelled, earliest });
  };

  for (const job of jobs) {
    if (!ACTIVE_JOB_STATUSES.has(job.status)) continue;
    // Saved means not applied yet, so the deadline is what matters. Once
    // applied, only the follow-up is actionable.
    const dates =
      job.status === "Saved"
        ? [{ date: job.deadline, role: "deadline" as const }]
        : [{ date: job.follow_up_date, role: "follow_up" as const }];
    add(job.id, "/applications", job.company, job.role_type, "Job", job.status, dates);
  }

  for (const h of hackathons) {
    if (!ACTIVE_HACKATHON_STATUSES.has(h.status)) continue;
    const dates =
      h.status === "Saved"
        ? [{ date: h.deadline, role: "deadline" as const }]
        : [{ date: h.follow_up_date, role: "follow_up" as const }];
    add(
      h.id,
      "/applications",
      h.hackathon_name,
      h.round_detail,
      "Hackathon",
      h.status,
      dates
    );
  }

  for (const t of tasks) {
    if (t.status !== "Done") {
      add(t.id, "/tasks", t.title, null, "Task", t.status, [
        { date: t.due_date, role: "due" },
      ]);
    }
  }

  for (const item of trackItems) {
    if (item.status !== "Done") {
      add(
        item.id,
        `/tracks/${item.track_id}`,
        `${trackTitles.get(item.track_id) ?? "Track"} · ${item.title}`,
        null,
        "Course step",
        item.status,
        [{ date: item.target_date, role: "due" }]
      );
    }
  }

  candidates.sort((a, b) => (a.earliest < b.earliest ? -1 : 1));
  const attention = candidates.slice(0, 6);

  // ── Calendar timeline ────────────────────────────────────────────────────
  const events = buildCalendarEvents({
    tasks,
    jobs: jobs.map((j) => ({
      id: j.id,
      company: j.company,
      status: j.status,
      deadline: j.deadline,
      follow_up_date: j.follow_up_date,
    })),
    hackathons: hackathons.map((h) => ({
      id: h.id,
      hackathon_name: h.hackathon_name,
      status: h.status,
      start_date: h.start_date,
      deadline: h.deadline,
      follow_up_date: h.follow_up_date,
    })),
    trackItems: trackItems.map((i) => ({
      track_id: i.track_id,
      title: i.title,
      status: i.status,
      target_date: i.target_date,
    })),
    trackTitles,
  });

  // ── Two-column row ───────────────────────────────────────────────────────
  const openTasks: HubTask[] = tasks
    .filter((t) => t.status !== "Done")
    .sort((a, b) => daysUntil(a.due_date ?? "2999-12-31") - daysUntil(b.due_date ?? "2999-12-31"))
    .slice(0, 5);

  const hubJobs: HubApplication[] = jobs
    .filter((j) => ACTIVE_JOB_STATUSES.has(j.status))
    .map((j) => ({ id: j.id, title: j.company, status: j.status, date: j.deadline ?? j.follow_up_date }))
    .sort(bySoonest);

  const hubHackathons: HubApplication[] = hackathons
    .filter((h) => ACTIVE_HACKATHON_STATUSES.has(h.status))
    .map((h) => ({
      id: h.id,
      title: h.hackathon_name,
      status: h.status,
      date: h.deadline ?? h.follow_up_date,
    }))
    .sort(bySoonest);

  return (
    <>
      <PostLoginLoader initiallyActive={justSignedIn === "1"} />
      <PageTransition>
        <NameEntryGate needsName={needsName} />

        <HubHeader greeting={greeting} name={hasEnteredName ? username : undefined} />

        <AttentionStrip items={attention} />

        <NotesCarousel notes={notes} />

        <CalendarTimeline eventsByDate={Object.fromEntries(groupByDate(events))} />

        {/* `minmax(0,1fr)` is load-bearing: the default implicit `auto` column
            is floored at its items' min-content, and a `truncate` span is
            `white-space: nowrap`, so its min-content is the full unwrapped
            text. That floor pushed the column wider than the phone viewport. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 md:items-start">
          <TasksPanel tasks={openTasks} />
          <ApplicationsPanel jobs={hubJobs} hackathons={hubHackathons} />
        </div>
      </PageTransition>
    </>
  );
}

/** Soonest first; undated rows sink to the bottom. */
function bySoonest(a: HubApplication, b: HubApplication) {
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date < b.date ? -1 : 1;
}