"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveOffset, trackSchema, type ParsedTrack } from "@/lib/tracks/contract";

type ActionResult = { error?: string };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Normalizes a parsed AI track into learning_tracks / track_phases /
 *  track_items rows. Offsets are resolved against the chosen start date. */
export async function importTrack(
  track: ParsedTrack,
  startDate: string
): Promise<ActionResult & { trackId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (!isoDate.safeParse(startDate).success) {
    return { error: "Pick a valid start date." };
  }

  // Server actions are public endpoints; never trust the client-side parser.
  const parsedTrack = trackSchema.safeParse(track);
  if (!parsedTrack.success) {
    return { error: "The track contains invalid or unsafe content." };
  }
  track = parsedTrack.data;

  const { data: inserted, error: trackError } = await supabase
    .from("learning_tracks")
    .insert({
      user_id: user.id,
      title: track.track_title,
      description: track.description || null,
      start_date: startDate,
      status: "In progress",
    })
    .select("id")
    .single();
  if (trackError || !inserted) {
    return { error: trackError?.message ?? "Could not create the track." };
  }

  const trackId = inserted.id;

  for (let p = 0; p < track.phases.length; p++) {
    const phase = track.phases[p];
    const { data: phaseRow, error: phaseError } = await supabase
      .from("track_phases")
      .insert({
        track_id: trackId,
        user_id: user.id,
        position: p,
        title: phase.title,
        description: phase.description || null,
      })
      .select("id")
      .single();
    if (phaseError || !phaseRow) {
      await supabase.from("learning_tracks").delete().eq("id", trackId);
      return { error: phaseError?.message ?? "Could not create a phase." };
    }

    const rows = phase.items.map((item, i) => ({
      track_id: trackId,
      phase_id: phaseRow.id,
      user_id: user.id,
      position: i,
      title: item.title,
      description: item.description || null,
      resource_url:
        item.resource_url && item.resource_url !== "" ? item.resource_url : null,
      target_date: item.absolute_date
        ? item.absolute_date
        : item.offset_days !== null && item.offset_days !== undefined
          ? resolveOffset(startDate, item.offset_days)
          : null,
      status: "To do",
    }));

    const { error: itemsError } = await supabase.from("track_items").insert(rows);
    if (itemsError) {
      await supabase.from("learning_tracks").delete().eq("id", trackId);
      return { error: itemsError.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${trackId}`);
  return { trackId };
}

/** Flips an item's status and keeps the parent track's status in sync:
 *  all items done → track Completed, otherwise In progress. */
export async function setTrackItemStatus(
  id: string,
  status: "To do" | "In progress" | "Done"
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("track_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  // Derive track status from its items.
  const { data: item } = await supabase
    .from("track_items")
    .select("track_id")
    .eq("id", id)
    .single();
  if (item) {
    const { data: siblings } = await supabase
      .from("track_items")
      .select("status")
      .eq("track_id", item.track_id);
    const list = siblings ?? [];
    const trackStatus =
      list.length > 0 && list.every((s) => s.status === "Done")
        ? "Completed"
        : "In progress";
    await supabase
      .from("learning_tracks")
      .update({ status: trackStatus, updated_at: new Date().toISOString() })
      .eq("id", item.track_id)
      .neq("status", "On hold");

    revalidatePath("/");
    revalidatePath("/tracks");
    revalidatePath(`/tracks/${item.track_id}`);
  }
  return {};
}

/** Cycles an item: To do → In progress → Done → To do. */
export async function cycleTrackItemStatus(
  id: string,
  current: "To do" | "In progress" | "Done"
): Promise<ActionResult> {
  const next =
    current === "To do" ? "In progress" : current === "In progress" ? "Done" : "To do";
  return setTrackItemStatus(id, next);
}

export async function deleteTrack(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Phases and items cascade via on delete cascade.
  const { error } = await supabase.from("learning_tracks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/tracks");
  return {};
}

export async function setTrackStatus(
  id: string,
  status: "In progress" | "Completed" | "On hold"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("learning_tracks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${id}`);
  return {};
}
