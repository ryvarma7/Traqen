import { redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { ApplicationsView } from "@/components/applications/applications-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const supabase = await createClient();

  // Auth check runs in parallel with the reads; RLS scopes rows to auth.uid().
  const [userRes, jobsRes, hackathonsRes, optionsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("job_applications").select("*"),
    supabase.from("hackathons").select("*"),
    supabase.from("dropdown_options").select("*"),
  ]);

  if (!userRes.data.user) redirect("/login");

  return (
    <>
      <PageTransition>
        <ApplicationsView
          jobs={jobsRes.data ?? []}
          hackathons={hackathonsRes.data ?? []}
          dropdownOptions={optionsRes.data ?? []}
        />
      </PageTransition>
    </>
  );
}
