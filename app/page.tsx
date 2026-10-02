import { redirect } from "next/navigation";
import { AttentionStrip, type AttentionItem } from "@/components/hub/attention-strip";
import { NavCards, type HubCard } from "@/components/hub/nav-cards";
import { PageTransition } from "@/components/shell/page-transition";
import { PostLoginLoader } from "@/components/shell/post-login-loader";
import { NameEntryGate } from "@/components/hub/name-entry-gate";
import { createClient } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/dates";
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
  const [userRes, profileRes, jobsRes, hackathonsRes, tasksRes, notesRes, tracksRes, trackItemsRes] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("username, preferences").single(),
      supabase.from("job_applications").select("id, company, status, deadline, follow_up_date"),
      supabase.from("hackathons").select("id, hackathon_name, status, deadline, follow_up_date"),
      supabase.from("tasks").select("id, title, status, due_date"),
      supabase.from("notes").select("id", { count: "exact", head: true }),
      supabase.from("learning_tracks").select("id, title, status"),
      supabase.from("track_items").select("track_id, title, status, target_date"),
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
  const notesCount = notesRes.count ?? 0;
  const tracks = tracksRes.data ?? [];
  const trackItems = trackItemsRes.data ?? [];
  const trackTitles = new Map(tracks.map((t) => [t.id, t.title]));

  // Collect upcoming deadlines and follow-ups across all sections,
  // keep only items within 14 days (or overdue), nearest first.
  const candidates: AttentionItem[] = [];
  const push = (
    id: string,
    href: string,
    title: string,
    meta: string,
    date: string | null
  ) => {
    if (!date) return;
    const days = daysUntil(date);
    if (days > 14) return;
    candidates.push({ id, href, title, meta, date });
  };

  for (const job of jobs) {
    push(job.id, "/applications", job.company, "Job · deadline", job.deadline);
    push(job.id, "/applications", job.company, "Job · follow-up", job.follow_up_date);
  }
  for (const h of hackathons) {
    push(h.id, "/applications", h.hackathon_name, "Hackathon · deadline", h.deadline);
    push(h.id, "/applications", h.hackathon_name, "Hackathon · follow-up", h.follow_up_date);
  }
  for (const t of tasks) {
    if (t.status !== "Done") {
      push(t.id, "/tasks", t.title, "Task · due", t.due_date);
    }
  }
  for (const item of trackItems) {
    if (item.status !== "Done") {
      push(
        item.track_id,
        `/tracks/${item.track_id}`,
        `${trackTitles.get(item.track_id) ?? "Track"} · ${item.title}`,
        "Course step",
        item.target_date
      );
    }
  }

  candidates.sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
  const attention = candidates.slice(0, 5);

  const activeJobs = jobs.filter((j) => ACTIVE_JOB_STATUSES.has(j.status)).length;
  const activeHackathons = hackathons.filter((h) =>
    ACTIVE_HACKATHON_STATUSES.has(h.status)
  ).length;
  const activeTasks = tasks.filter((t) => t.status !== "Done").length;
  const activeTracks = tracks.filter((t) => t.status === "In progress").length;

  const cards: HubCard[] = [
    {
      href: "/applications",
      title: "Applications",
      description: "Jobs and hackathons you're tracking.",
      count: activeJobs + activeHackathons,
      countLabel: "active",
      icon: "briefcase",
    },
    {
      href: "/tasks",
      title: "Tasks",
      description: "Everything you need to get done.",
      count: activeTasks,
      countLabel: "open",
      icon: "tasks",
    },
    {
      href: "/notes",
      title: "Notes",
      description: "Ideas, prep, and things to remember.",
      count: notesCount,
      countLabel: notesCount === 1 ? "note" : "notes",
      icon: "notes",
    },
    {
      href: "/tracks",
      title: "Course Tracker",
      description: "AI-planned learning tracks, checked off step by step.",
      count: activeTracks,
      countLabel: activeTracks === 1 ? "active track" : "active tracks",
      icon: "tracks",
    },
  ];

  return (
    <>
      <PostLoginLoader initiallyActive={justSignedIn === "1"} />
      <PageTransition>
        <NameEntryGate needsName={needsName} />
        <div className="mb-8 md:mb-10">
          <p className="text-[20px] md:text-[24px] font-semibold tracking-tight text-white">
            {greeting}{" "}
            {hasEnteredName && (
              <span className="text-white/60 transition-opacity duration-300">
                {username}
              </span>
            )}
          </p>
        </div>
        <AttentionStrip items={attention} />
        <NavCards cards={cards} />
      </PageTransition>
    </>
  );
}
