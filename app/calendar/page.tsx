import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar/calendar-view";
import { CalendarPrompt } from "@/components/calendar/calendar-prompt";
import { PageTransition } from "@/components/shell/page-transition";
import { buildCalendarEvents, groupByDate } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = createClient();

  // Auth check in parallel with the reads; RLS scopes rows to auth.uid().
  const [userRes, tasksRes, jobsRes, hackathonsRes, tracksRes, trackItemsRes, feedbackRes] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.from("tasks").select("id, title, status, due_date"),
      supabase.from("job_applications").select("id, company, status, deadline, follow_up_date"),
      supabase.from("hackathons").select("id, hackathon_name, status, start_date, deadline, follow_up_date"),
      supabase.from("learning_tracks").select("id, title"),
      supabase.from("track_items").select("track_id, title, status, target_date"),
      // The one-time GCal suggestion popup shows only while no answer row
      // exists — server-side, so it stays dismissed across devices.
      supabase.from("calendar_feedback").select("id").limit(1),
    ]);

  if (!userRes.data.user) redirect("/login");

  const tracks = tracksRes.data ?? [];
  const events = buildCalendarEvents({
    tasks: tasksRes.data ?? [],
    jobs: jobsRes.data ?? [],
    hackathons: hackathonsRes.data ?? [],
    trackItems: trackItemsRes.data ?? [],
    trackTitles: new Map(tracks.map((t) => [t.id, t.title])),
  });

  const showPrompt = (feedbackRes.data ?? []).length === 0;

  return (
    <PageTransition>
      <CalendarView eventsByDate={Object.fromEntries(groupByDate(events))} />
      {showPrompt && <CalendarPrompt />}
    </PageTransition>
  );
}