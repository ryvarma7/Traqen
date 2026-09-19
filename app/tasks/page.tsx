import { redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { TasksView } from "@/components/tasks/tasks-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = createClient();

  // Auth check runs in parallel with the reads; RLS scopes rows to auth.uid().
  const [userRes, tasksRes, jobsRes, hackathonsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("tasks").select("*"),
    supabase.from("job_applications").select("id, company"),
    supabase.from("hackathons").select("id, hackathon_name"),
  ]);

  if (!userRes.data.user) redirect("/login");

  const linkables = [
    ...(jobsRes.data ?? []).map((j) => ({
      id: j.id,
      label: j.company,
      type: "job" as const,
    })),
    ...(hackathonsRes.data ?? []).map((h) => ({
      id: h.id,
      label: h.hackathon_name,
      type: "hackathon" as const,
    })),
  ];

  return (
    <>
      <PageTransition>
        <TasksView tasks={tasksRes.data ?? []} linkables={linkables} />
      </PageTransition>
    </>
  );
}
