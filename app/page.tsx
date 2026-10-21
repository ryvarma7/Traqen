import { redirect } from "next/navigation";
import { ApplicationsPanel, type HubApplication } from "@/components/hub/applications-panel";
import {
  AttentionStrip,
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
import { priorityRank } from "@/lib/priority";
import { createClient } from "@/lib/supabase/server";
import { nextStepByTrack as nextStepByTrackFor } from "@/lib/track-plan";
import {
  ACTIVE_HACKATHON_STATUSES,
  ACTIVE_JOB_STATUSES,
} from "@/lib/types";

export const dynamic = "force-dynamic";

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
    trackPhasesRes,
    trackItemsRes,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("username, preferences").single(),
    supabase
      .from("job_applications")
      .select("id, company, role_type, status, priority, deadline, follow_up_date"),
    supabase
      .from("hackathons")
      .select("id, hackathon_name, round_detail, status, priority, start_date, deadline, follow_up_date"),
    supabase.from("tasks").select("id, title, status, priority, due_date"),
    supabase
      .from("notes")
      .select("id, title, content, color, pinned, private, updated_at")
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase.from("learning_tracks").select("id, title, status"),
    supabase.from("track_phases").select("id, track_id, position"),
    supabase
      .from("track_items")
      .select("id, track_id, phase_id, title, status, target_date, position"),
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
  const trackPhases = trackPhasesRes.data ?? [];
  const trackItems = trackItemsRes.data ?? [];
  const trackTitles = new Map(tracks.map((t) => [t.id, t.title]));

  // ── Needs attention ──────────────────────────────────────────────────────
  // This is an action queue, not a second calendar. Only the next actionable
  // date for an entity is surfaced, plus records that need the user to create
  // a next step before they can be planned reliably.
  const HORIZON_DAYS = 7;
  /** Past this, an overdue row is stale history rather than a live reminder. */
  const STALE_OVERDUE_DAYS = -14;
  const ATTENTION_HACKATHON_STATUSES = new Set([
    "Saved",
    "Applied",
    "Shortlisted",
    "In progress",
  ]);
  const FOLLOW_UP_JOB_STATUSES = new Set([
    "Applied",
    "Interview",
    "Shortlisted",
  ]);
  const FOLLOW_UP_HACKATHON_STATUSES = new Set([
    "Applied",
    "Shortlisted",
    "In progress",
  ]);

  const candidates: AttentionItem[] = [];

  const addDated = (
    id: string,
    href: string,
    title: string,
    subtitle: string | null,
    kind: string,
    status: string,
    priority: string | null,
    date: string | null,
    role: AttentionItem["role"],
    action: string
  ) => {
    if (!date || !role) return;
    const days = daysUntil(date);
    if (days > HORIZON_DAYS || days < STALE_OVERDUE_DAYS) return;
    candidates.push({
      id,
      href,
      title,
      subtitle,
      kind,
      status,
      priority,
      group: days <= 0 ? "now" : "coming_up",
      date,
      role,
      action,
    });
  };

  const addMissingDate = (
    id: string,
    href: string,
    title: string,
    subtitle: string | null,
    kind: string,
    status: string,
    priority: string | null,
    action: string
  ) => {
    candidates.push({
      id,
      href,
      title,
      subtitle,
      kind,
      status,
      priority,
      group: "needs_next_step",
      date: null,
      role: null,
      action,
    });
  };

  for (const job of jobs) {
    if (!ACTIVE_JOB_STATUSES.has(job.status)) continue;
    if (job.status === "Saved") {
      addDated(
        job.id,
        "/applications",
        job.company,
        job.role_type,
        "Job",
        job.status,
        job.priority,
        job.deadline,
        "deadline",
        "Review deadline"
      );
    } else {
      addDated(
        job.id,
        "/applications",
        job.company,
        job.role_type,
        "Job",
        job.status,
        job.priority,
        job.follow_up_date,
        "follow_up",
        "Follow up"
      );
      if (FOLLOW_UP_JOB_STATUSES.has(job.status) && !job.follow_up_date) {
        addMissingDate(
          job.id,
          "/applications",
          job.company,
          job.role_type,
          "Job",
          job.status,
          job.priority,
          "Set follow-up"
        );
      }
    }
  }

  for (const h of hackathons) {
    if (!ATTENTION_HACKATHON_STATUSES.has(h.status)) continue;
    if (h.status === "Saved") {
      addDated(
        h.id,
        "/applications",
        h.hackathon_name,
        h.round_detail,
        "Hackathon",
        h.status,
        h.priority,
        h.deadline,
        "deadline",
        "Review deadline"
      );
    } else {
      addDated(
        h.id,
        "/applications",
        h.hackathon_name,
        h.round_detail,
        "Hackathon",
        h.status,
        h.priority,
        h.follow_up_date,
        "follow_up",
        "Follow up"
      );
      if (FOLLOW_UP_HACKATHON_STATUSES.has(h.status) && !h.follow_up_date) {
        addMissingDate(
          h.id,
          "/applications",
          h.hackathon_name,
          h.round_detail,
          "Hackathon",
          h.status,
          h.priority,
          "Set follow-up"
        );
      }
    }
  }

  for (const t of tasks) {
    if (t.status === "Done") continue;
    if (t.due_date) {
      addDated(
        t.id,
        "/tasks",
        t.title,
        null,
        "Task",
        t.status,
        t.priority,
        t.due_date,
        "due",
        "Complete task"
      );
    } else if (t.priority === "High") {
      addMissingDate(
        t.id,
        "/tasks",
        t.title,
        null,
        "Task",
        t.status,
        t.priority,
        "Set due date"
      );
    }
  }

  // Only the next unfinished step per active track. An imported plan is a long
  // ordered list of dated steps; surfacing all of them turns the queue into a
  // syllabus and buries a real deadline behind it. The step is derived by the
  // same rule the track page uses, so the hub and the track page can never
  // disagree about what "next" means.
  const nextStepByTrack = nextStepByTrackFor(tracks, trackPhases, trackItems);
  for (const item of nextStepByTrack.values()) {
    const trackTitle = trackTitles.get(item.track_id) ?? "Track";
    if (item.target_date) {
      addDated(
        item.id,
        `/tracks/${item.track_id}`,
        item.title,
        trackTitle,
        "Course step",
        item.status,
        null,
        item.target_date,
        "due",
        "Continue track"
      );
    } else {
      addMissingDate(
        item.id,
        `/tracks/${item.track_id}`,
        item.title,
        trackTitle,
        "Course step",
        item.status,
        null,
        "Plan this step"
      );
    }
  }

  // Urgency is the first sort key. Priority then breaks ties, so a near-term
  // high-priority action is not buried behind a lower-impact item with the
  // same date. Missing dates intentionally sort last.
  const urgency = (item: AttentionItem) => {
    if (!item.date) return 4;
    const days = daysUntil(item.date);
    if (days < 0) return 0;
    if (days === 0) return 1;
    if (days <= 3) return 2;
    return 3;
  };
  candidates.sort(
    (a, b) =>
      urgency(a) - urgency(b) ||
      priorityRank(a.priority) - priorityRank(b.priority) ||
      (a.date ?? "9999-12-31").localeCompare(b.date ?? "9999-12-31") ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id)
  );
  const attention = candidates;

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
      id: i.id,
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

        {/* `minmax(0,1fr)` is load-bearing: the default implicit `auto` column
            is floored at its items' min-content, and a `truncate` span is
            `white-space: nowrap`, so its min-content is the full unwrapped
            text. That floor pushed the column wider than the phone viewport.

            Stacked, the panels are already separated by their own `mb-4`, so the
            row gap only applies to the two-column desktop layout — otherwise a
            phone would see 32px between two panels that read as one column. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-0 md:grid-cols-2 md:items-start">
          <TasksPanel tasks={openTasks} />
          <ApplicationsPanel jobs={hubJobs} hackathons={hubHackathons} />
        </div>

        <CalendarTimeline eventsByDate={Object.fromEntries(groupByDate(events))} />

        <NotesCarousel notes={notes} />
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
