"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidDateOnly } from "@/lib/dates";
import { safeActionError } from "@/lib/action-errors";
import { NvidiaRequestError, generateNvidiaText } from "@/lib/nvidia";
import { createClient } from "@/lib/supabase/server";
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
  planEnrichmentBatches,
  type EnrichedStep,
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
/** Hard ceiling below the route's 240-second platform limit. */
const PLAN_GENERATION_BUDGET_MS = 225_000;

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
  if (!user) return { error: "Your session has expired. Please sign in again." };

  if (typeof startDate !== "string" || !isValidDateOnly(startDate)) {
    return { error: "Pick a valid start date." };
  }

  // Server actions are public endpoints; never trust the client-side parser.
  const parsedTrack = trackSchema.safeParse(track);
  if (!parsedTrack.success) {
    return { error: "We couldn't use that learning plan. Please try again." };
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
        return { error: "Some steps have conflicting dates. Please review the plan and try again." };
      }

      const targetDate = item.absolute_date
        ? item.absolute_date
        : item.offset_days !== null && item.offset_days !== undefined
          ? resolveOffset(startDate, item.offset_days)
          : null;
      if (!targetDate) continue;
      if (targetDate < startDate || (endDate && targetDate > endDate)) {
        return { error: "Some steps fall outside the selected date range. Please review the plan and try again." };
      }
    }
  }

  const phases = track.phases.map((phase) => ({
    title: phase.title,
    description: phase.description || null,
    items: phase.items.map((item) => ({
      title: item.title,
      description: item.description || null,
      resource_url:
        item.resource_url && item.resource_url !== "" ? item.resource_url : null,
      target_date: item.absolute_date
        ? item.absolute_date
        : item.offset_days !== null && item.offset_days !== undefined
          ? resolveOffset(startDate, item.offset_days)
          : null,
    })),
  }));

  const { data: trackId, error: trackError } = await supabase.rpc(
    "create_learning_track",
    {
      p_title: track.track_title,
      p_description: track.description || null,
      p_start_date: startDate,
      p_end_date: endDate || null,
      p_phases: phases,
    }
  );
  if (trackError || typeof trackId !== "string") {
    return {
      error: safeActionError(
        trackError,
        trackError?.code === "PGRST202"
          ? "We couldn't create your learning track right now. Please try again later."
          : "We couldn't create your learning track. Please try again."
      ),
    };
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
  input: LearningPlanInput,
  deadline: number
): Promise<ParsedTrack | null> {
  for (const compact of [false, true]) {
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new NvidiaRequestError("timeout");
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
        timeoutMs: Math.min(
          compact ? COMPACT_OUTLINE_TIMEOUT_MS : OUTLINE_TIMEOUT_MS,
          remaining
        ),
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
 * Every batch of steps is written by its own call, and all of them run at
 * once. A phase with more steps than one call can carry is written in
 * several calls, so a course can hold as many steps as it needs. A batch
 * whose call fails leaves those steps with the outline's objective as their
 * description, so a plan is always complete and readable: the worst a
 * failed call leaves behind is a one-line instruction instead of a detailed
 * one.
 */
async function enrichOutline(
  outline: ParsedTrack,
  input: LearningPlanInput,
  deadline: number
): Promise<ParsedTrack> {
  // One brief per batch of steps. A batch keeps the step's own index inside
  // its phase, so the answers merge back into the right place.
  const batches = planEnrichmentBatches(outline);
  const briefs = batches.map((batch) => ({
    phaseIndex: batch.phaseIndex,
    indexes: batch.steps.map((step) => step.index),
    brief: {
      title: outline.phases[batch.phaseIndex].title,
      description: outline.phases[batch.phaseIndex].description ?? null,
      steps: batch.steps,
    },
  }));

  const results = await mapWithLimit(briefs, ENRICH_CONCURRENCY, async (entry, index) => {
    if (index > 0) {
      // The stagger is bounded by the number of calls in flight, so a plan
      // with many batches does not push the last one minutes into the wait.
      await new Promise((resolve) =>
        setTimeout(resolve, ENRICH_STAGGER_MS * (index % ENRICH_CONCURRENCY))
      );
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new NvidiaRequestError("timeout");
    const { system, user } = buildEnrichMessages({
      trackTitle: outline.track_title,
      trackDescription: outline.description ?? null,
      topic: input.topic,
      phase: entry.brief,
    });
    const raw = await generateNvidiaText(user, {
      system,
      // The course is already designed. There is nothing left to weigh, so
      // the reasoning trace is pure cost here.
      thinking: false,
      timeoutMs: Math.min(ENRICH_TIMEOUT_MS, remaining),
    });
    const parsed = parseEnrichment(raw);
    if (!parsed.ok) {
      console.warn("NVIDIA NIM learning plan enrichment did not match the contract", {
        phase: entry.brief.title,
        reason: parsed.error,
        responseLength: raw.length,
      });
      return null;
    }
    // Keep only the steps this batch was given: a model that answered for
    // more than it was asked about must not write another batch's steps.
    const allowed = new Set(entry.indexes);
    return new Map(
      [...parsed.steps].filter(([stepIndex]) => allowed.has(stepIndex))
    );
  });

  // Fold the batches back into one map of answers per phase.
  const perPhase: Array<Map<number, EnrichedStep>> = outline.phases.map(
    () => new Map()
  );
  briefs.forEach((entry, index) => {
    const result = results[index];
    if (result.status !== "fulfilled" || !result.value) return;
    for (const [stepIndex, step] of result.value) {
      perPhase[entry.phaseIndex].set(stepIndex, step);
    }
  });

  const { track, failedPhases } = mergeEnrichment(
    outline,
    perPhase.map((steps) => (steps.size > 0 ? steps : null))
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
    return { error: "Your session has expired. Please sign in again.", code: "UNAUTHENTICATED" };
  }

  const parsedInput = learningPlanInputSchema.safeParse(input);
  if (!parsedInput.success) {
    // The form holds itself to the same limits, so this is a backstop — but
    // it is the one failure the learner only sees as a generic message, so
    // the field that was rejected is worth having in the log.
    console.warn("Learning plan input was rejected", {
      issues: parsedInput.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`),
    });
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
      error: "AI planning is temporarily unavailable. Please try again later.",
      code: "QUOTA_SETUP_REQUIRED",
    };
  }
  if (quota === "unavailable") {
    return {
      error: "We couldn't check your daily AI plan limit. Please try again.",
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
    const deadline = Date.now() + PLAN_GENERATION_BUDGET_MS;
    const outline = await generateOutline(parsedInput.data, deadline);
    if (!outline) {
      return {
        remaining: quota.remaining,
        resetDate: quota.resetDate,
        error: "We couldn't verify the generated learning plan. Please try again.",
        code: "INVALID_PLAN",
      };
    }

    const merged = await enrichOutline(outline, parsedInput.data, deadline);

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
        error: "We couldn't verify the generated learning plan. Please try again.",
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
          error: "AI planning is temporarily unavailable. Please try again later.",
          code: "GENERATION_NOT_CONFIGURED",
        };
      }
      if (error.code === "timeout") {
        return {
          remaining: quota.remaining,
          resetDate: quota.resetDate,
          error: "AI planning took too long to respond. Please try again.",
          code: "GENERATION_TIMEOUT",
        };
      }
      if (error.code === "incomplete") {
        return {
          remaining: quota.remaining,
          resetDate: quota.resetDate,
          error: "The AI planner couldn't finish the plan. Please try again.",
          code: "GENERATION_INCOMPLETE",
        };
      }
    }

    return {
      remaining: quota.remaining,
      resetDate: quota.resetDate,
      error: "AI planning is temporarily unavailable. Please try again in a moment.",
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
    return { error: "Your session has expired. Please sign in again.", code: "UNAUTHENTICATED" };
  }

  const quota = await readLearningPlanQuota(supabase);
  if (quota === "setup_required") {
    return {
      error: "AI planning is temporarily unavailable. Please try again later.",
      code: "QUOTA_SETUP_REQUIRED",
    };
  }
  if (quota === "unavailable") {
    return {
      error: "We couldn't load your daily AI plan limit. Please try again.",
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
  if (!user) return { error: "Your session has expired. Please sign in again." };
  if (!idSchema.safeParse(id).success) return { error: "Unable to update this step." };
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedStatus.success) return { error: "Invalid track step status." };

  const { data, error } = await supabase.rpc("set_track_item_status", {
    p_item_id: id,
    p_status: parsedStatus.data,
  });
  if (error) {
    return {
      error: safeActionError(
        error,
        error.code === "PGRST202"
          ? "We couldn't update this step right now. Please try again."
          : error.code === "P0002"
            ? "That track step doesn't exist."
            : "Unable to update this track step."
      ),
    };
  }
  const item = rpcRow(data) as { track_id?: unknown } | null;
  if (!item || typeof item.track_id !== "string") {
    return { error: "That track step doesn't exist." };
  }

  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${item.track_id}`);
  return {};
}

export async function deleteTrack(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };
  if (!idSchema.safeParse(id).success) return { error: "Unable to delete this track." };
  // Phases and items cascade via on delete cascade.
  const { data, error } = await supabase.from("learning_tracks").delete()
    .eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) return { error: safeActionError(error, "Unable to delete this track.") };
  if (!data) return { error: "That track no longer exists." };
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
  if (!user) return { error: "Your session has expired. Please sign in again." };
  if (!idSchema.safeParse(id).success) return { error: "Unable to update this track." };
  const parsedStatus = z.enum(["In progress", "Completed", "On hold"]).safeParse(status);
  if (!parsedStatus.success) return { error: "Invalid track status." };
  const { data, error } = await supabase
    .from("learning_tracks")
    .update({ status: parsedStatus.data, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: safeActionError(error, "Unable to update this track.") };
  if (!data) return { error: "That track no longer exists." };
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
  if (!user) return { error: "Your session has expired. Please sign in again." };

  if (!idSchema.safeParse(trackId).success) {
    return { error: "That track doesn't exist." };
  }

  // A shape check would still let "2026-02-31" through, and addDaysISO would
  // then roll it into March and write the wrong date.
  if (typeof newStartISO !== "string" || !isValidDateOnly(newStartISO)) {
    return { error: "Pick a valid start date." };
  }

  const { data, error } = await supabase.rpc("reschedule_learning_track", {
    p_track_id: trackId,
    p_new_start: newStartISO,
  });
  if (error) {
    return {
      error: safeActionError(
        error,
        error.code === "PGRST202"
          ? "We couldn't reschedule your track right now. Please try again."
          : error.code === "P0002"
            ? "That track doesn't exist."
            : "Unable to reschedule the track steps."
      ),
    };
  }

  const result = rpcRow(data) as { moved?: unknown; delta?: unknown } | null;
  const moved = typeof result?.moved === "number" ? result.moved : 0;
  const delta = typeof result?.delta === "number" ? result.delta : 0;
  if (moved === 0) return { error: "No dated steps left to reschedule." };

  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${trackId}`);
  return { moved, delta };
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
  if (!user) return { error: "Your session has expired. Please sign in again." };

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
  if (!user) return { error: "Your session has expired. Please sign in again." };
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

  const { data, error } = await supabase
    .from("track_items")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: safeActionError(error, "Unable to update this step.") };
  }
  if (!data) return { error: "That step doesn't exist." };

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
  if (!user) return { error: "Your session has expired. Please sign in again." };
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

  const { data, error } = await supabase
    .from("track_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: safeActionError(error, "Unable to remove this step.") };
  }
  if (!data) return { error: "That step doesn't exist." };

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
  if (!user) return { error: "Your session has expired. Please sign in again." };
  if (!idSchema.safeParse(id).success) {
    return { error: "Unable to move this step." };
  }
  if (direction !== "up" && direction !== "down") {
    return { error: "Invalid move." };
  }

  const { data, error } = await supabase.rpc("reorder_track_items", {
    p_item_id: id,
    p_direction: direction,
  });
  if (error) {
    return {
      error: safeActionError(
        error,
        error.code === "PGRST202"
          ? "We couldn't move this step right now. Please try again."
          : error.code === "P0002"
            ? "That step doesn't exist."
            : "Unable to move this step."
      ),
    };
  }
  const result = rpcRow(data) as { moved?: unknown; track_id?: unknown } | null;
  if (!result || typeof result.track_id !== "string") return { error: "That step doesn't exist." };
  if (result.moved !== true) return {};

  revalidatePath("/tracks");
  revalidatePath(`/tracks/${result.track_id}`);
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
  if (!user) return { error: "Your session has expired. Please sign in again." };
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(phaseId).success) {
    return { error: "Unable to move this step." };
  }

  const { data, error } = await supabase.rpc("move_track_item_to_phase", {
    p_item_id: id,
    p_phase_id: phaseId,
  });
  if (error) {
    return {
      error: safeActionError(
        error,
        error.code === "PGRST202"
          ? "We couldn't move this step right now. Please try again."
          : error.code === "P0002"
            ? "That step or phase doesn't exist."
            : "Unable to move this step."
      ),
    };
  }
  const result = rpcRow(data) as { moved?: unknown; track_id?: unknown } | null;
  if (!result || typeof result.track_id !== "string") return { error: "That step or phase doesn't exist." };
  if (result.moved !== true) return {};

  revalidatePath("/tracks");
  revalidatePath(`/tracks/${result.track_id}`);
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
  if (!user) return { error: "Your session has expired. Please sign in again." };
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
  if (!user) return { error: "Your session has expired. Please sign in again." };
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

  const { data, error } = await supabase
    .from("track_phases")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: safeActionError(error, "Unable to update this phase.") };
  }
  if (!data) return { error: "That phase doesn't exist." };

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
  if (!user) return { error: "Your session has expired. Please sign in again." };
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
  const { data, error } = await supabase
    .from("track_phases")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: safeActionError(error, "Unable to remove this phase.") };
  }
  if (!data) return { error: "That phase doesn't exist." };

  await syncTrackStatus(supabase, existing.track_id, user.id);
  revalidatePath("/");
  revalidatePath("/tracks");
  revalidatePath(`/tracks/${existing.track_id}`);
  return {};
}
