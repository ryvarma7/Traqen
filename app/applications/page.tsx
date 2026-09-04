import { redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { TopBar } from "@/components/shell/top-bar";
import { ApplicationsView } from "@/components/applications/applications-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [jobsRes, hackathonsRes, optionsRes] = await Promise.all([
    supabase.from("job_applications").select("*").eq("user_id", user.id),
    supabase.from("hackathons").select("*").eq("user_id", user.id),
    supabase.from("dropdown_options").select("*").eq("user_id", user.id),
  ]);

  return (
    <>
      <TopBar />
      <PageTransition>
        <h1 className="mb-6 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          Applications
        </h1>
        <ApplicationsView
          jobs={jobsRes.data ?? []}
          hackathons={hackathonsRes.data ?? []}
          dropdownOptions={optionsRes.data ?? []}
        />
      </PageTransition>
    </>
  );
}
