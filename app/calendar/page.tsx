import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PageTransition } from "@/components/shell/page-transition";
import { buildCalendarEvents, groupByDate } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import { requireAuthData, requireQueryData } from "@/lib/supabase/query";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createClient();

  // Auth check in parallel with the reads; RLS scopes rows to auth.uid().
  const [userRes, tasksRes, jobsRes, hackathonsRes, tracksRes, trackItemsRes] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.from("tasks").select("id, title, status, due_date"),
      supabase.from("job_applications").select("id, company, status, deadline, follow_up_date"),
      supabase.from("hackathons").select("id, hackathon_name, status, start_date, deadline, follow_up_date"),
      supabase.from("learning_tracks").select("id, title"),
      supabase.from("track_items").select("id, track_id, title, status, target_date"),
    ]);

  const auth = requireAuthData(userRes, "calendar auth");
  if (!auth.user) redirect("/login");

  const tracks = requireQueryData(tracksRes, "calendar tracks");
  const events = buildCalendarEvents({
    tasks: requireQueryData(tasksRes, "calendar tasks"),
    jobs: requireQueryData(jobsRes, "calendar job applications"),
    hackathons: requireQueryData(hackathonsRes, "calendar hackathons"),
    trackItems: requireQueryData(trackItemsRes, "calendar track items"),
    trackTitles: new Map(tracks.map((t) => [t.id, t.title])),
  });

  return (
    <PageTransition>
      <CalendarView eventsByDate={Object.fromEntries(groupByDate(events))} />
    </PageTransition>
  );
}
