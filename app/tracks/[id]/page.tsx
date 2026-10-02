import { notFound, redirect } from "next/navigation";
import { PageTransition } from "@/components/shell/page-transition";
import { TrackDetailView } from "@/components/tracks/track-detail-view";
import { createClient } from "@/lib/supabase/server";

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
    supabase.from("learning_tracks").select("*").eq("id", id).maybeSingle(),
    supabase.from("track_phases").select("*").eq("track_id", id).order("position"),
    supabase.from("track_items").select("*").eq("track_id", id).order("position"),
  ]);

  if (!userRes.data.user) redirect("/login");
  if (!trackRes.data) notFound();

  return (
    <>
      <PageTransition>
        <TrackDetailView
          track={trackRes.data}
          phases={phasesRes.data ?? []}
          items={itemsRes.data ?? []}
        />
      </PageTransition>
    </>
  );
}
