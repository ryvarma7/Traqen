import { redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { TracksView, type TrackSummary } from "@/components/tracks/tracks-view";
import { createClient } from "@/lib/supabase/server";
import { nextStepByTrack } from "@/lib/track-plan";
import { requireAuthData, requireQueryData } from "@/lib/supabase/query";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

export default async function TracksPage() {
  const supabase = await createClient();

  // Auth check in parallel with the reads; RLS scopes rows to auth.uid().
  const [userRes, tracksRes, phasesRes, itemsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("learning_tracks")
      .select("id, title, description, start_date, end_date, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("track_phases").select("id, track_id, position, title"),
    supabase
      .from("track_items")
      .select("id, track_id, phase_id, title, status, target_date, position"),
  ]);

  const auth = requireAuthData(userRes, "tracks auth");
  if (!auth.user) redirect("/login");

  const tracksData = requireQueryData(tracksRes, "learning tracks");
  const phasesData = requireQueryData(phasesRes, "track phases");
  const itemsData = requireQueryData(itemsRes, "track items");

  // Aggregate per-track progress client-side from the items rows. Items are
  // two-state in the UI (done / not done); rows still carrying the legacy
  // "In progress" value simply count as not done.
  const totals = new Map<string, { total: number; done: number }>();
  for (const item of itemsData) {
    const agg = totals.get(item.track_id) ?? { total: 0, done: 0 };
    agg.total += 1;
    if (item.status === "Done") agg.done += 1;
    totals.set(item.track_id, agg);
  }

  // The same derivation the track page uses, so a card and the plan it
  // opens can never disagree about what comes next.
  const nextSteps = nextStepByTrack(
    tracksData,
    phasesData,
    itemsData
  );

  const tracks: TrackSummary[] = tracksData.map((t) => {
    const next = nextSteps.get(t.id);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      start_date: t.start_date,
      end_date: t.end_date,
      status: t.status,
      created_at: t.created_at,
      total: totals.get(t.id)?.total ?? 0,
      done: totals.get(t.id)?.done ?? 0,
      nextTitle: next?.title ?? null,
      nextDate: next?.target_date ?? null,
    };
  });

  return (
    <>
      <PageTransition>
        <TracksView tracks={tracks} />
      </PageTransition>
    </>
  );
}
