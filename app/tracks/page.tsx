import { redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { TracksView, type TrackSummary } from "@/components/tracks/tracks-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TracksPage() {
  const supabase = await createClient();

  // Auth check in parallel with the reads; RLS scopes rows to auth.uid().
  const [userRes, tracksRes, itemsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("learning_tracks").select("*").order("created_at", { ascending: false }),
    supabase.from("track_items").select("track_id, status"),
  ]);

  if (!userRes.data.user) redirect("/login");

  // Aggregate per-track progress client-side from the items rows.
  const totals = new Map<string, { total: number; done: number; in_progress: number }>();
  for (const item of itemsRes.data ?? []) {
    const agg = totals.get(item.track_id) ?? { total: 0, done: 0, in_progress: 0 };
    agg.total += 1;
    if (item.status === "Done") agg.done += 1;
    if (item.status === "In progress") agg.in_progress += 1;
    totals.set(item.track_id, agg);
  }

  const tracks: TrackSummary[] = (tracksRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    start_date: t.start_date,
    status: t.status,
    created_at: t.created_at,
    total: totals.get(t.id)?.total ?? 0,
    done: totals.get(t.id)?.done ?? 0,
    in_progress: totals.get(t.id)?.in_progress ?? 0,
  }));

  return (
    <>
      <PageTransition>
        <TracksView tracks={tracks} />
      </PageTransition>
    </>
  );
}
