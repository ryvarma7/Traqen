"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDaysISO, diffDaysISO, isValidDateOnly } from "@/lib/dates";
import { safeActionError } from "@/lib/action-errors";
import { NvidiaRequestError, generateNvidiaText } from "@/lib/nvidia";
import { createClient } from "@/lib/supabase/server";
import { moveWithinOrder } from "@/lib/track-plan";
import {
  learningPlanInputSchema,
  resolveOffset,
  resourceUrlSchema,
  trackSchema,
  type LearningPlanInput,
  type ParsedTrack,
} from "@/lib/tracks/contract";
import {
  buildEnrichMessages,
  mergeEnrichment,
  parseEnrichment,
  type EnrichmentPhase,
} from "@/lib/tracks/enrich";
import { buildOutlineMessages, parseOutline } from "@/lib/tracks/outline";

const DAILY_LEARNING_PLAN_LIMIT = 5;

// A plan is generated in two stages.
//
// The outline is the expensive, single, reasoned call: it decides the whole
// curriculum and answers with the shape of the course, so it carries the
// reasoning budget. The enrichment is one small call per phase, with the
// reasoning off: writing the instructions for six steps does not need a
// model to weigh curriculum shapes.
//
// The budgets add up to less than the 240 seconds the Tracks action is
// allowed to run for, so the worst case — the outline timing out, the
// compact outline being attempted, and the enrichment running — still lands
// inside the limit with room to spare.
const OUTLINE_TIMEOUT_MS = 160_000;
const COMPACT_OUTLINE_TIMEOUT_MS = 30_000;
const ENRICH_TIMEOUT_MS = 30_000;

/**
 * How many enrichment calls may be in flight at once.
 *
 * The phases are independent, so they can all go out together, and each one
 * is a small request that answers in a fraction of the outline's time — so
 * running them all at once costs one round, not two. The limit is here to
 * bound a pathological plan, not to throttle a normal one.
 */
const ENRICH_CONCURRENCY = 8;

/**
 * A pause between starting the enrichment calls, in milliseconds.
 *
 * A plan of seven phases would otherwise put seven requests on the provider
 * in the same instant. A short stagger spreads them out at no real cost to
 * the total time, and it gives a rate limiter room to breathe.
 */
const ENRICH_STAGGER_MS = 200;

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

/**
 * Stage 1 — the outline.
 *
 * One reasoned call that decides the whole course: its title, its phases,
 * and every step's title, objective and date. A model can stop after
 * producing valid-looking prose or partial JSON, especially when the
 * configured model has a smaller effective output budget, so a compact
 * retry is attempted before the stage gives up. Provider failures are not
 * retried here because generateNvidiaText already handles transient HTTP
 * retries.
 */
async function generateOutline(
  input: LearningPlanInput
): Promise<ParsedTrack | null> {
  for (const compact of [false, true]) {
    try {
      const { system, user } = buildOutlineMessages(input, { compact });
      // The first attempt lets the model reason before it answers, so it
      // designs the curriculum properly. The compact retry turns the
      // reasoning off: it exists precisely because the first attempt ran
      // out of budget or missed the contract, and a lean request is far
      // more likely to land inside the time left.
      const raw = await generateNvidiaText(user, {
        system,
        thinking: compact ? false : undefined,
        effort: compact ? undefined : "medium",
        timeoutMs: compact ? COMPACT_OUTLINE_TIMEOUT_MS : OUTLINE_TIMEOUT_MS,
      });
      const parsed = parseOutline(raw, input);
      if (parsed.ok) return parsed.outline;

      console.warn("NVIDIA NIM learning plan outline did not match the contract", {
        attempt: compact ? 2 : 1,
        reason: parsed.error,
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
            ? "NVIDIA NIM learning plan outline timed out; retrying compact output"
            : "NVIDIA NIM learning plan outline was truncated; retrying compact output",
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

  return null;
}

/**
 * Runs `worker` over every item with at most `limit` calls in flight at
 * once, and settles every one of them.
 *
 * A rejected call is reported rather than thrown, so one phase failing does
 * not take the rest of the plan down with it.
 */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;

  const runner = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  const workers = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workers }, runner));
  return results;
}

/**
 * Stage 2 — the per-phase enrichment.
 *
 * Every phase is written by its own call, and all of them run at once. A
 * phase whose enrichment fails keeps the outline's objective as its step
 * descriptions, so a plan is always complete and readable: the worst a
 * failed call leaves behind is a one-line instruction instead of a detailed
 * one.
 */
async function enrichOutline(
  outline: ParsedTrack,
  input: LearningPlanInput
): Promise<ParsedTrack> {
  const briefs: EnrichmentPhase[] = outline.phases.map((phase) => ({
    title: phase.title,
    description: phase.description ?? null,
    steps: phase.items.map((item, index) => ({
      index,
      title: item.title,
      // The outline's objective is the seed the instruction is written from.
      objective: item.description ?? item.title,
    })),
  }));

  const results = await mapWithLimit(briefs, ENRICH_CONCURRENCY, async (phase, index) => {
    if (index > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, ENRICH_STAGGER_MS * index)
      );
    }
    const { system, user } = buildEnrichMessages({
      trackTitle: outline.track_title,
      trackDescription: outline.description ?? null,
      topic: input.topic,
      phase,
    });
    const raw = await generateNvidiaText(user, {
      system,
      // The course is already designed. There is nothing left to weigh, so
      // the reasoning trace is pure cost here.
      thinking: false,
      timeoutMs: ENRICH_TIMEOUT_MS,
    });
    const parsed = parseEnrichment(raw);
    if (!parsed.ok) {
      console.warn("NVIDIA NIM learning plan enrichment did not match the contract", {
        phase: phase.title,
        reason: parsed.error,
        responseLength: raw.length,
      });
      return null;
    }
    return parsed.steps;
  });

  const { track, failedPhases } = mergeEnrichment(
    outline,
    results.map((result) => (result.status === "fulfilled" ? result.value : null))
  );

  const stepCount = track.phases.reduce((count, phase) => count + phase.items.length, 0);
  console.info("NVIDIA NIM learning plan generated", {
    phases: track.phases.length,
    steps: stepCount,
    failedPhases,
  });

  return track;
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
    const outline = await generateOutline(parsedInput.data);
    if (!outline) {
      return {
        remaining: quota.remaining,
        resetDate: quota.resetDate,
        error: "The generated learning plan could not be validated.",
        code: "INVALID_PLAN",
      };
    }

    const merged = await enrichOutline(outline, parsedInput.data);

    // The final gate. The merge only ever adds detail to steps the outline
    // already validated, so this should never fail — but the plan is what
    // gets written to the database, so it is checked as a whole.
    const validated = trackSchema.safeParse(merged);
    if (!validated.success) {
      console.warn("NVIDIA NIM learning plan failed the final validation", {
        issues: validated.error.issues.slice(0, 5).map((issue) => issue.path.join(".")),
      });
      return {
        remaining: quota.remaining,
        resetDate: quota.resetDate,
        error: "The generated learning plan could not be validated.",
        code: "INVALID_PLAN",
      };
    }

    return {
      track: validated.data,
      remaining: quota.remaining,
      resetDate: quota.resetDate,
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
    await syncTrackStatus(supabase, item.track_id, user.id);

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

/* ── Editing the plan ─────────────────────────────────────────────────────
 *
 * An imported plan is a starting point, not a contract. The learner needs to
 * be able to fix a date, rename a step, add the reading they were actually
 * assigned, and drop the part of the course that turned out to be
 * irrelevant. These actions are what make the plan theirs.
 * ──────────────────────────────────────────────────────────────────────── */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const editableDateSchema = z
  .string()
  .refine(isValidDateOnly, "Expected a real calendar date")
  .nullable()
  .optional();

const itemFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    description: z.string().max(5000).optional().nullable(),
    resource_url: resourceUrlSchema,
    target_date: editableDateSchema,
  })
  .strict();

const itemPatchSchema = itemFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

const phaseFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    description: z.string().max(5000).optional().nullable(),
  })
  .strict();

const phasePatchSchema = phaseFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

/**
 * Re-derives a track's status from its steps: all done → Completed, anything
 * else → In progress. An on-hold track is left alone, because "on hold" is a
 * decision the user made and a step toggle should not quietly undo it.
 */
async function syncTrackStatus(
  supabase: Supabase,
  trackId: string,
  userId: string
) {
  const { data: items, error } = await supabase
    .from("track_items")
    .select("status")
    .eq("track_id", trackId)
    .eq("user_id", userId);
  if (error || !items) return;

  const status =
    items.length > 0 && items.every((item) => item.status === "Done")
      ? "Completed"
      : "In progress";

  await supabase
    .from("learning_tracks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", trackId)
    .eq("user_id", userId)
    .neq("status", "On hold");
}

/** Rewrites a phase's step positions to 0, 1, 2, … so the stored order is
 *  always the order the steps are shown in. */
async function reindexPhase(
  supabase: Supabase,
  phaseId: string,
  userId: string
) {
  const { data: items } = await supabase
    .from("track_items")
    .select("id")
    .eq("phase_id", phaseId)
    .eq("user_id", userId)
    .order("position");
  if (!items || items.length === 0) return;

  await Promise.all(
    items.map((item, index) =>
      supabase
        .from("track_items")
        .update({ position: index })
        .eq("id", item.id)
        .eq("user_id", userId)
    )
  );
}

/** The position a step added to a phase should take: one past the last. */
async function nextPosition(
  supabase: Supabase,
  phaseId: string,
  userId: string
): Promise<number> {
  const { data: siblings } = await supabase
    .from("track_items")
    .select("position")
    .eq("phase_id", phaseId)
    .eq("user_id", userId);
  return (siblings ?? []).reduce(
    (max, row) => Math.max(max, row.position ?? 0),
    -1
  ) + 1;
}

/** Adds a step to the end of a phase. */
export async function createTrackItem(
  trackId: string,
  phaseId: string,
  input: {
    title: string;
    description?: string | null;
    resource_url?: string | null;
    target_date?: string | null;
  }
): Promise<ActionResult & { itemId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (
    !idSchema.safeParse(trackId).success ||
    !idSchema.safeParse(phaseId).success
  ) {
    return { error: "Unable to add this step." };
  }

  const parsed = itemFieldsSchema.safeParse(input);
  if (!parsed.success) return { error: "Give the step a title." };

  // The phase has to belong to the caller's track, or to no track at all —
  // never to somebody else's.
  const { data: phase, error: phaseError } = await supabase
    .from("track_phases")
    .select("id")
    .eq("id", phaseId)
    .eq("track_id", trackId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (phaseError) {
    return { error: safeActionError(phaseError, "Unable to add this step.") };
  }
  if (!phase) return { error: "That phase doesn't exist." };

  const position = await nextPosition(supabase, phaseId, user.id);

  const { data: inserted, error: insertError } = await supabase
    .from("track_items")
    .insert({
      track_id: trackId,
      phase_id: phaseId,
      user_id: user.id,
      position,
      title: parsed.data.title,
      description: parsed.data.description || null,
      resource_url: parsed.data.resource_url ?? null,
      target_date: parsed.data.target_date ?? null,
      status: "To do",
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return { error: safeActionError(insertError, "Unable to add this step.") };
  }

  await syncTrackStatus(supabase, trackId, user.id);
  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${trackId}`);
  return { itemId: inserted.id };
}

/** Edits a step's title, description, date or resource. */
export async function updateTrackItem(
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    resource_url?: string | null;
    target_date?: string | null;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) {
    return { error: "Unable to update this step." };
  }

  const parsed = itemPatchSchema.safeParse(patch);
  if (!parsed.success) return { error: "Nothing to update." };

  const { data: existing, error: readError } = await supabase
    .from("track_items")
    .select("id, track_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    return { error: safeActionError(readError, "Unable to update this step.") };
  }
  if (!existing) return { error: "That step doesn't exist." };

  // Only the fields the user actually sent are written, so an omitted
  // field is left exactly as it was.
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.description !== undefined) {
    update.description = parsed.data.description || null;
  }
  if (parsed.data.resource_url !== undefined) {
    update.resource_url = parsed.data.resource_url;
  }
  if (parsed.data.target_date !== undefined) {
    update.target_date = parsed.data.target_date ?? null;
  }

  const { error } = await supabase
    .from("track_items")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return { error: safeActionError(error, "Unable to update this step.") };
  }

  await syncTrackStatus(supabase, existing.track_id, user.id);
  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${existing.track_id}`);
  return {};
}

/** Removes a step and closes the gap it left in the phase. */
export async function deleteTrackItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) {
    return { error: "Unable to remove this step." };
  }

  const { data: existing, error: readError } = await supabase
    .from("track_items")
    .select("id, track_id, phase_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    return { error: safeActionError(readError, "Unable to remove this step.") };
  }
  if (!existing) return { error: "That step doesn't exist." };

  const { error } = await supabase
    .from("track_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return { error: safeActionError(error, "Unable to remove this step.") };
  }

  await reindexPhase(supabase, existing.phase_id, user.id);
  await syncTrackStatus(supabase, existing.track_id, user.id);
  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${existing.track_id}`);
  return {};
}

/** Moves a step one place up or down inside its phase. */
export async function moveTrackItem(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) {
    return { error: "Unable to move this step." };
  }
  if (direction !== "up" && direction !== "down") {
    return { error: "Invalid move." };
  }

  const { data: existing, error: readError } = await supabase
    .from("track_items")
    .select("id, track_id, phase_id, position")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    return { error: safeActionError(readError, "Unable to move this step.") };
  }
  if (!existing) return { error: "That step doesn't exist." };

  const { data: siblings } = await supabase
    .from("track_items")
    .select("id, position")
    .eq("phase_id", existing.phase_id)
    .eq("user_id", user.id)
    .order("position");

  const ordered = siblings ?? [];
  const order = moveWithinOrder(
    ordered.map((row) => row.id),
    id,
    direction
  );
  // The step is already at the edge it was asked to move past.
  if (!order) return {};

  // The whole phase is renumbered from the new order, so the stored
  // positions are always 0, 1, 2, … and always match the display.
  const stamp = new Date().toISOString();
  const results = await Promise.all(
    order.map((stepId, index) =>
      supabase
        .from("track_items")
        .update({ position: index, updated_at: stamp })
        .eq("id", stepId)
        .eq("phase_id", existing.phase_id)
        .eq("user_id", user.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { error: safeActionError(failed.error, "Unable to move this step.") };
  }

  revalidatePath("/tracks");
  revalidatePath(`/tracks/${existing.track_id}`);
  return {};
}

/** Moves a step into a different phase of the same track. */
export async function moveTrackItemToPhase(
  id: string,
  phaseId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(phaseId).success) {
    return { error: "Unable to move this step." };
  }

  const { data: existing, error: readError } = await supabase
    .from("track_items")
    .select("id, track_id, phase_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    return { error: safeActionError(readError, "Unable to move this step.") };
  }
  if (!existing) return { error: "That step doesn't exist." };
  if (existing.phase_id === phaseId) return {};

  const { data: target, error: targetError } = await supabase
    .from("track_phases")
    .select("id")
    .eq("id", phaseId)
    .eq("track_id", existing.track_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (targetError) {
    return { error: safeActionError(targetError, "Unable to move this step.") };
  }
  if (!target) return { error: "That phase doesn't exist." };

  const position = await nextPosition(supabase, phaseId, user.id);
  const { error } = await supabase
    .from("track_items")
    .update({
      phase_id: phaseId,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return { error: safeActionError(error, "Unable to move this step.") };
  }

  // Both phases lose a slot or gain one, so both are renumbered.
  await reindexPhase(supabase, existing.phase_id, user.id);
  await reindexPhase(supabase, phaseId, user.id);
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${existing.track_id}`);
  return {};
}

/** Adds a phase to the end of a track. */
export async function createTrackPhase(
  trackId: string,
  input: { title: string; description?: string | null }
): Promise<ActionResult & { phaseId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(trackId).success) {
    return { error: "Unable to add this phase." };
  }

  const parsed = phaseFieldsSchema.safeParse(input);
  if (!parsed.success) return { error: "Give the phase a title." };

  const { data: track, error: trackError } = await supabase
    .from("learning_tracks")
    .select("id")
    .eq("id", trackId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (trackError) {
    return { error: safeActionError(trackError, "Unable to add this phase.") };
  }
  if (!track) return { error: "That track doesn't exist." };

  const { data: siblings } = await supabase
    .from("track_phases")
    .select("position")
    .eq("track_id", trackId)
    .eq("user_id", user.id);
  const position =
    (siblings ?? []).reduce((max, row) => Math.max(max, row.position ?? 0), -1) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("track_phases")
    .insert({
      track_id: trackId,
      user_id: user.id,
      position,
      title: parsed.data.title,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return { error: safeActionError(insertError, "Unable to add this phase.") };
  }

  revalidatePath("/tracks");
  revalidatePath(`/tracks/${trackId}`);
  return { phaseId: inserted.id };
}

/** Edits a phase's title or description. */
export async function updateTrackPhase(
  id: string,
  patch: { title?: string; description?: string | null }
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) {
    return { error: "Unable to update this phase." };
  }

  const parsed = phasePatchSchema.safeParse(patch);
  if (!parsed.success) return { error: "Nothing to update." };

  const { data: existing, error: readError } = await supabase
    .from("track_phases")
    .select("id, track_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    return { error: safeActionError(readError, "Unable to update this phase.") };
  }
  if (!existing) return { error: "That phase doesn't exist." };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.description !== undefined) {
    update.description = parsed.data.description || null;
  }

  const { error } = await supabase
    .from("track_phases")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return { error: safeActionError(error, "Unable to update this phase.") };
  }

  revalidatePath("/tracks");
  revalidatePath(`/tracks/${existing.track_id}`);
  return {};
}

/** Removes a phase and every step inside it. */
export async function deleteTrackPhase(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  if (!idSchema.safeParse(id).success) {
    return { error: "Unable to remove this phase." };
  }

  const { data: existing, error: readError } = await supabase
    .from("track_phases")
    .select("id, track_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    return { error: safeActionError(readError, "Unable to remove this phase.") };
  }
  if (!existing) return { error: "That phase doesn't exist." };

  // The steps inside the phase cascade with it.
  const { error } = await supabase
    .from("track_phases")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return { error: safeActionError(error, "Unable to remove this phase.") };
  }

  await syncTrackStatus(supabase, existing.track_id, user.id);
  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${existing.track_id}`);
  return {};
}
