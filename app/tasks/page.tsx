import { redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { TopBar } from "@/components/shell/top-bar";
import { TasksView } from "@/components/tasks/tasks-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [tasksRes, jobsRes, hackathonsRes] = await Promise.all([
    supabase.from("tasks").select("*").eq("user_id", user.id),
    supabase.from("job_applications").select("id, company").eq("user_id", user.id),
    supabase.from("hackathons").select("id, hackathon_name").eq("user_id", user.id),
  ]);

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
      <TopBar />
      <PageTransition>
        <h1 className="mb-6 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          Tasks
        </h1>
        <TasksView tasks={tasksRes.data ?? []} linkables={linkables} />
      </PageTransition>
    </>
  );
}
