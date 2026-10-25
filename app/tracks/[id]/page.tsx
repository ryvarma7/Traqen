import { notFound, redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { TrackDetailView } from "@/components/tracks/track-detail-view";
import { createClient } from "@/lib/supabase/server";
import { requireAuthData, requireQueryData } from "@/lib/supabase/query";

export const dynamic = "force-dynamic";

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS guarantees these rows belong to the signed-in user.
  const [userRes, trackRes, phasesRes, itemsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("learning_tracks")
       .select("id, title, description, start_date, end_date, status, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("track_phases")
      .select("id, track_id, position, title, description")
      .eq("track_id", id)
      .order("position"),
    supabase
      .from("track_items")
      .select("id, track_id, phase_id, position, title, description, resource_url, target_date, status")
      .eq("track_id", id)
      .order("position"),
  ]);

  const auth = requireAuthData(userRes, "track detail auth");
  if (!auth.user) redirect("/login");
  const track = requireQueryData(trackRes, "track detail");
  const phases = requireQueryData(phasesRes, "track detail phases");
  const items = requireQueryData(itemsRes, "track detail items");
  if (!track) notFound();

  return (
    <>
      <PageTransition>
        <TrackDetailView
          track={track}
          phases={phases}
          items={items}
        />
      </PageTransition>
    </>
  );
}
