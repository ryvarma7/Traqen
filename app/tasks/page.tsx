import { redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { TasksView } from "@/components/tasks/tasks-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();

  // Auth check runs in parallel with the reads; RLS scopes rows to auth.uid().
  const [userRes, tasksRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("tasks")
      .select("id, title, description, notes, status, priority, due_date, category, related_type, related_name"),
  ]);

  if (!userRes.data.user) redirect("/login");

  return (
    <>
      <PageTransition>
        <TasksView tasks={tasksRes.data ?? []} />
      </PageTransition>
    </>
  );
}
