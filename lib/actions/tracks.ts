"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDaysISO, diffDaysISO, isValidDateOnly } from "@/lib/dates";
import { safeActionError } from "@/lib/action-errors";
import { NvidiaRequestError, generateNvidiaText } from "@/lib/nvidia";
import { createClient } from "@/lib/supabase/server";
import {
  buildLearningPlanMessages,
  learningPlanInputSchema,
  parseGeneratedTrack,
  resolveOffset,
  trackSchema,
  type LearningPlanInput,
  type ParsedTrack,
} from "@/lib/tracks/contract";

const DAILY_LEARNING_PLAN_LIMIT = 5;

// The Tracks page allows 240 seconds of server action time. The full attempt
// gets most of it, and the compact retry keeps enough left to still return a
// plan when the first answer was truncated, missed the contract, or ran long.
// The hosted endpoint generates roughly 40 to 55 tokens a second for this
// model, and a reasoned plan lands between 150 and 180 seconds, so the
// budgets are sized for the answer length rather than for the request.
const REASONED_TIMEOUT_MS = 180_000;
const COMPACT_RETRY_TIMEOUT_MS = 50_000;

export type LearningPlanErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_INPUT"
  | "QUOTA_UNAVAILABLE"
  | "QUOTA_SETUP_REQUIRED"
  | "QUOTA_EXCEEDED"
  | "GENERATION_NOT_CONFIGURED"
  | "GENERATION_TIMEOUT"
  | "GENERATION_INCOMPLETE"
  | "GENERATION_UNAVAILABLE"
  | "INVALID_PLAN";

export type GenerateLearningPlanResult = {
  track?: ParsedTrack;
  remaining?: number;
  resetDate?: string;
  error?: string;
  code?: LearningPlanErrorCode;
};

export type LearningPlanQuotaResult = {
  used?: number;
  remaining?: number;
  limit?: number;
  resetDate?: string;
  error?: string;
  code?: LearningPlanErrorCode;
};

type ActionResult = { error?: string; code?: LearningPlanErrorCode };

const idSchema = z.string().uuid();
const statusSchema = z.enum(["To do", "In progress", "Done"]);

/** Normalizes a parsed AI track into learning_tracks / track_phases /
 *  track_items rows. Offsets are resolved against the chosen start date. */
export async function importTrack(
  track: ParsedTrack,
  startDate: string,
  endDate?: string | null
): Promise<ActionResult & { trackId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (typeof startDate !== "string" || !isValidDateOnly(startDate)) {
    return { error: "Pick a valid start date." };
  }

  // Server actions are public endpoints; never trust the client-side parser.
  const parsedTrack = trackSchema.safeParse(track);
  if (!parsedTrack.success) {
    return { error: "The track contains invalid or unsafe content." };
  }
  track = parsedTrack.data;

  if (endDate !== undefined && endDate !== null && !isValidDateOnly(endDate)) {
    return { error: "Pick a valid end date." };
  }
  if (endDate && endDate < startDate) {
    return { error: "End date must be on or after the start date." };
  }

  // Re-check every persisted date on the server. This prevents a forged track
  // from writing dates outside the selected range, even if the UI validated it.
  for (const phase of track.phases) {
    for (const item of phase.items) {
      if (item.absolute_date && item.offset_days !== null && item.offset_days !== undefined) {
        return { error: "The track contains conflicting step dates." };
      }

      const targetDate = item.absolute_date
        ? item.absolute_date
        : item.offset_days !== null && item.offset_days !== undefined
          ? resolveOffset(startDate, item.offset_days)
          : null;
      if (!targetDate) continue;
      if (targetDate < startDate || (endDate && targetDate > endDate)) {
        return { error: "The track contains a step outside the selected date range." };
      }
    }
  }

  const { data: inserted, error: trackError } = await supabase
    .from("learning_tracks")
    .insert({
      user_id: user.id,
      title: track.track_title,
      description: track.description || null,
      start_date: startDate,
      end_date: endDate || null,
      status: "In progress",
    })
    .select("id")
    .single();
  if (trackError || !inserted) {
    return { error: safeActionError(trackError, "Could not create the track.") };
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
      await supabase
        .from("learning_tracks")
        .delete()
        .eq("id", trackId)
        .eq("user_id", user.id);
      return { error: safeActionError(phaseError, "Could not create a phase.") };
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
      await supabase
        .from("learning_tracks")
        .delete()
        .eq("id", trackId)
        .eq("user_id", user.id);
      return { error: safeActionError(itemsError, "Could not create the track steps.") };
    }
  }

  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${trackId}`);
  return { trackId };
}

const quotaDateSchema = z.string().refine(isValidDateOnly);
const quotaSchema = z.object({
  used: z.number().int().min(0).max(DAILY_LEARNING_PLAN_LIMIT),
  remaining: z.number().int().min(0).max(DAILY_LEARNING_PLAN_LIMIT),
  quota_limit: z.literal(DAILY_LEARNING_PLAN_LIMIT),
  reset_date: quotaDateSchema,
});
const consumedQuotaSchema = quotaSchema.extend({ allowed: z.boolean() });

type Quota = {
  used: number;
  remaining: number;
  limit: number;
  resetDate: string;
};

type QuotaReadFailure = "unavailable" | "setup_required";

function rpcRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

async function consumeLearningPlanQuota(supabase: Awaited<ReturnType<typeof createClient>>): Promise<
  (Quota & { allowed: boolean }) | QuotaReadFailure
> {
  const { data, error } = await supabase.rpc("consume_learning_plan_quota");
  if (error) return error.code === "PGRST202" ? "setup_required" : "unavailable";

  const parsed = consumedQuotaSchema.safeParse(rpcRow(data));
  if (!parsed.success) return "unavailable";

  return {
    allowed: parsed.data.allowed,
    used: parsed.data.used,
    remaining: parsed.data.remaining,
    limit: parsed.data.quota_limit,
    resetDate: parsed.data.reset_date,
  };
}

async function readLearningPlanQuota(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Quota | QuotaReadFailure> {
  const { data, error } = await supabase.rpc("get_learning_plan_quota");
  if (error) return error.code === "PGRST202" ? "setup_required" : "unavailable";

  const parsed = quotaSchema.safeParse(rpcRow(data));
  if (!parsed.success) return "unavailable";

  return {
    used: parsed.data.used,
    remaining: parsed.data.remaining,
    limit: parsed.data.quota_limit,
    resetDate: parsed.data.reset_date,
  };
}

/** Generates a validated learning plan without persisting it. */
export async function generateLearningPlan(
  input: LearningPlanInput
): Promise<GenerateLearningPlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in.", code: "UNAUTHENTICATED" };
  }

  const parsedInput = learningPlanInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return {
      error: "Enter a topic and a valid start date. The end date is optional.",
      code: "INVALID_INPUT",
    };
  }

  // The RPC owns the row lock and UTC-day boundary. Never implement this
  // check as a read followed by a client-side insert/update.
  const quota = await consumeLearningPlanQuota(supabase);
  if (quota === "setup_required") {
    return {
      error: "Learning-plan quota setup is incomplete.",
      code: "QUOTA_SETUP_REQUIRED",
    };
  }
  if (quota === "unavailable") {
    return {
      error: "Could not check the daily generation limit.",
      code: "QUOTA_UNAVAILABLE",
    };
  }
  if (!quota.allowed) {
    return {
      remaining: quota.remaining,
      resetDate: quota.resetDate,
      error: "Daily generation limit reached. Try again tomorrow.",
      code: "QUOTA_EXCEEDED",
    };
  }

  try {
    // A model can stop after producing valid-looking prose or partial JSON,
    // especially when the configured model has a smaller effective output
    // budget. Retry once with a deliberately compact contract before showing
    // an error to the user. Provider failures are not retried here because
    // generateNvidiaText already handles transient HTTP retries.
    for (const compact of [false, true]) {
      try {
        const { system, user } = buildLearningPlanMessages(parsedInput.data, {
          compact,
        });
        // The first attempt lets the model reason before it answers, so it
        // designs the curriculum properly. The compact retry turns the
        // reasoning off: it exists precisely because the first attempt ran
        // out of budget or missed the contract, and a lean request is far
        // more likely to land inside the time left.
        //
        // The two timeouts add up to the 240 seconds the Tracks action is
        // allowed to run for: the first attempt gets the time it needs, and
        // the compact retry still has room to produce a plan.
        const raw = await generateNvidiaText(user, {
          system,
          thinking: compact ? false : undefined,
          timeoutMs: compact ? COMPACT_RETRY_TIMEOUT_MS : REASONED_TIMEOUT_MS,
        });
        const parsedTrack = parseGeneratedTrack(raw, parsedInput.data);
        if (parsedTrack.ok) {
          return {
            track: parsedTrack.track,
            remaining: quota.remaining,
            resetDate: quota.resetDate,
          };
        }

        console.warn("NVIDIA NIM learning plan did not match the contract", {
          attempt: compact ? 2 : 1,
          reason: parsedTrack.error,
          responseLength: raw.length,
        });
      } catch (error) {
        if (
          error instanceof NvidiaRequestError &&
          !compact &&
          (error.code === "incomplete" || error.code === "timeout")
        ) {
          console.warn(
            error.code === "timeout"
              ? "NVIDIA NIM learning plan timed out; retrying compact output"
              : "NVIDIA NIM learning plan was truncated; retrying compact output",
            {
              attempt: 1,
              status: error.status,
            }
          );
          continue;
        }
        throw error;
      }
    }

    return {
      remaining: quota.remaining,
      resetDate: quota.resetDate,
      error: "The generated learning plan could not be validated.",
      code: "INVALID_PLAN",
    };
  } catch (error) {
    if (error instanceof NvidiaRequestError) {
      if (error.code === "configuration") {
        return {
          remaining: quota.remaining,
          resetDate: quota.resetDate,
          error: "Learning-plan generation is not available yet.",
          code: "GENERATION_NOT_CONFIGURED",
        };
      }
      if (error.code === "timeout") {
        return {
          remaining: quota.remaining,
          resetDate: quota.resetDate,
          error: "Learning-plan generation timed out. Try again.",
          code: "GENERATION_TIMEOUT",
        };
      }
      if (error.code === "incomplete") {
        return {
          remaining: quota.remaining,
          resetDate: quota.resetDate,
          error: "The AI planner returned an incomplete response. Try again.",
          code: "GENERATION_INCOMPLETE",
        };
      }
    }

    return {
      remaining: quota.remaining,
      resetDate: quota.resetDate,
      error: "Learning-plan generation is temporarily unavailable.",
      code: "GENERATION_UNAVAILABLE",
    };
  }
}

/** Returns the authenticated user's current UTC-day generation quota. */
export async function getLearningPlanQuota(): Promise<LearningPlanQuotaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in.", code: "UNAUTHENTICATED" };
  }

  const quota = await readLearningPlanQuota(supabase);
  if (quota === "setup_required") {
    return {
      error: "Learning-plan quota setup is incomplete.",
      code: "QUOTA_SETUP_REQUIRED",
    };
  }
  if (quota === "unavailable") {
    return {
      error: "Could not load the daily generation limit.",
      code: "QUOTA_UNAVAILABLE",
    };
  }

  return quota;
}

/** Flips an item's status and keeps the parent track's status in sync:
 *  all items done → track Completed, otherwise In progress. */
export async function setTrackItemStatus(
  id: string,
  status: "To do" | "In progress" | "Done"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) return { error: "Unable to update this step." };
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedStatus.success) return { error: "Invalid track step status." };

  const { data: item, error } = await supabase
    .from("track_items")
    .update({ status: parsedStatus.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, track_id")
    .maybeSingle();
  if (error) return { error: safeActionError(error, "Unable to update this track step.") };
  if (!item) return { error: "That track step doesn't exist." };

  // Derive track status from its items.
  if (item) {
    const { data: siblings, error: siblingError } = await supabase
      .from("track_items")
      .select("status")
      .eq("track_id", item.track_id)
      .eq("user_id", user.id);
    if (siblingError) return { error: safeActionError(siblingError, "Unable to update this track.") };
    const list = siblings ?? [];
    const trackStatus =
      list.length > 0 && list.every((s) => s.status === "Done")
        ? "Completed"
        : "In progress";
    await supabase
      .from("learning_tracks")
      .update({ status: trackStatus, updated_at: new Date().toISOString() })
      .eq("id", item.track_id)
      .eq("user_id", user.id)
      .neq("status", "On hold");

    revalidatePath("/");
    revalidatePath("/tracks");
    revalidatePath(`/tracks/${item.track_id}`);
  }
  return {};
}

export async function deleteTrack(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) return { error: "Unable to delete this track." };
  // Phases and items cascade via on delete cascade.
  const { error } = await supabase.from("learning_tracks").delete()
    .eq("id", id).eq("user_id", user.id);
  if (error) return { error: safeActionError(error, "Unable to delete this track.") };
  revalidatePath("/");
  revalidatePath("/tracks");
  return {};
}

export async function setTrackStatus(
  id: string,
  status: "In progress" | "Completed" | "On hold"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) return { error: "Unable to update this track." };
  const parsedStatus = z.enum(["In progress", "Completed", "On hold"]).safeParse(status);
  if (!parsedStatus.success) return { error: "Invalid track status." };
  const { error } = await supabase
    .from("learning_tracks")
    .update({ status: parsedStatus.data, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id);
  if (error) return { error: safeActionError(error, "Unable to update this track.") };
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

  if (!idSchema.safeParse(trackId).success) {
    return { error: "That track doesn't exist." };
  }

  // A shape check would still let "2026-02-31" through, and addDaysISO would
  // then roll it into March and write the wrong date.
  if (typeof newStartISO !== "string" || !isValidDateOnly(newStartISO)) {
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
  if (trackError) return { error: safeActionError(trackError, "Unable to load that track.") };
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
  if (readError) return { error: safeActionError(readError, "Unable to load the track steps.") };

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
  if (failed?.error) return { error: safeActionError(failed.error, "Unable to reschedule the track steps.") };

  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${trackId}`);
  return { moved: openDates.length, delta };
}
