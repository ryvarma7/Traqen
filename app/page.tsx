import { redirect } from "next/navigation";
import { AttentionStrip, type AttentionItem } from "@/components/hub/attention-strip";
import { NavCards, type HubCard } from "@/components/hub/nav-cards";
import { PageTransition } from "@/components/shell/page-transition";
import { createClient } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/dates";
import {
  ACTIVE_HACKATHON_STATUSES,
  ACTIVE_JOB_STATUSES,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const supabase = createClient();

  // Auth check runs in parallel with the reads — the queries don't need
  // user.id because RLS already scopes every table to auth.uid().
  const [userRes, jobsRes, hackathonsRes, tasksRes, notesRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("job_applications").select("id, company, status, deadline, follow_up_date"),
    supabase.from("hackathons").select("id, hackathon_name, status, deadline, follow_up_date"),
    supabase.from("tasks").select("id, title, status, due_date"),
    supabase.from("notes").select("id", { count: "exact", head: true }),
  ]);

  if (!userRes.data.user) redirect("/login");

  const jobs = jobsRes.data ?? [];
  const hackathons = hackathonsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const notesCount = notesRes.count ?? 0;

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

  candidates.sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
  const attention = candidates.slice(0, 5);

  const activeJobs = jobs.filter((j) => ACTIVE_JOB_STATUSES.has(j.status)).length;
  const activeHackathons = hackathons.filter((h) =>
    ACTIVE_HACKATHON_STATUSES.has(h.status)
  ).length;
  const activeTasks = tasks.filter((t) => t.status !== "Done").length;

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
  ];

  return (
    <>
      <PageTransition>
        <AttentionStrip items={attention} />
        <NavCards cards={cards} />
      </PageTransition>
    </>
  );
}
