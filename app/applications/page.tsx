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
    supabase
      .from("job_applications")
      .select("id, company, role_type, status, stage_detail, priority, location_mode, start_date, end_date, deadline, applied_date, follow_up_date, application_link, source, contact_person, notes"),
    supabase
      .from("hackathons")
      .select("id, hackathon_name, organizing_company, type, purpose, theme_track, track_details, mode, team_size, team_members, status, round_detail, priority, start_date, end_date, deadline, applied_date, follow_up_date, application_link, source, team_status, submission_link, result_rank, project_link, notes"),
    supabase.from("dropdown_options").select("id, section, field_name, value"),
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
