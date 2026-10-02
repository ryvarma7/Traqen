"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDaysISO, diffDaysISO, isValidDateOnly } from "@/lib/dates";
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

/**
 * Shifts every NOT-done, dated task forward so the next open task lands on
 * `newStartISO`. Every task moves by the same number of days, which preserves
 * the spacing between them and the order across phases; done tasks and phase
 * date ranges are left alone (a phase's range is derived from its items, so it
 * follows automatically). Phase ordering never changes.
 */
export async function rescheduleTrackItems(
  trackId: string,
  newStartISO: string
): Promise<ActionResult & { moved?: number; delta?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // A shape check would still let "2026-02-31" through, and addDaysISO would
  // then roll it into March and write the wrong date.
  if (!isValidDateOnly(newStartISO)) {
    return { error: "Pick a valid start date." };
  }

  // Explicit ownership check rather than leaning on the item RLS alone. The
  // wording is deliberately vague — it must not reveal that someone else's
  // track exists.
  const { data: track, error: trackError } = await supabase
    .from("learning_tracks")
    .select("id")
    .eq("id", trackId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (trackError) return { error: trackError.message };
  if (!track) return { error: "That track doesn't exist." };

  // RLS scopes this to the caller's own rows; the status and null-date
  // filters mean completed and undated steps can never be caught by the shift.
  const { data: items, error: readError } = await supabase
    .from("track_items")
    .select("id, target_date")
    .eq("track_id", trackId)
    .eq("user_id", user.id)
    .neq("status", "Done")
    .not("target_date", "is", null);
  if (readError) return { error: readError.message };

  const openDates = (items ?? [])
    .map((i) => i.target_date as string)
    .sort();

  if (openDates.length === 0) {
    return { error: "No dated steps left to reschedule." };
  }

  // Anchor on the earliest open dated task so the whole remaining plan slides
  // forward as one block.
  const delta = diffDaysISO(openDates[0], newStartISO);
  if (delta === 0) return { moved: 0, delta: 0 };

  const stamp = new Date().toISOString();
  // The query already excluded Done rows and null dates, so every returned
  // item is eligible and carries a target_date.
  const updates = (items ?? []).map((item) =>
    supabase
      .from("track_items")
      .update({
        target_date: addDaysISO(item.target_date as string, delta),
        updated_at: stamp,
      })
      // Re-assert every scoping column: even if the RLS policy were ever
      // loosened, this can only ever touch this user's steps in this track.
      .eq("id", item.id)
      .eq("track_id", trackId)
      .eq("user_id", user.id)
      .select("id")
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${trackId}`);
  return { moved: openDates.length, delta };
}
