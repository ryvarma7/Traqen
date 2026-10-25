import { z } from "zod";
import { diffDaysISO, isValidDateOnly } from "@/lib/dates";
import { LEARNING_PLAN_LIMITS } from "@/lib/tracks/limits";

/* ─────────────────────────────────────────────────────────────────────────
 * Learning-track contract.
 *
 * The NVIDIA NIM flow uses a strict JSON contract. The track shape is also
 * shared by the import action so client-supplied plans receive the same
 * validation.
 *
 * A plan is generated in two stages — an outline, then a per-phase
 * enrichment — so the shape of a finished plan is validated here, once, at
 * the end. The stages themselves live in lib/tracks/outline.ts and
 * lib/tracks/enrich.ts.
 * ──────────────────────────────────────────────────────────────────────── */

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(isValidDateOnly, "Expected a real calendar date");

export const learningPlanInputSchema = z
  .object({
    topic: z.string().trim().min(1).max(LEARNING_PLAN_LIMITS.topic),
    specs: z.string().trim().max(LEARNING_PLAN_LIMITS.specs),
    timeframe: z.string().trim().max(LEARNING_PLAN_LIMITS.timeframe),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema.optional().nullable(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.endDate && input.startDate > input.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date",
      });
    }
  });

export type LearningPlanInput = z.infer<typeof learningPlanInputSchema>;

/** The two messages a provider call is made from. */
export type LearningPlanMessages = {
  /** The contract: role, rules, schema, example. */
  system: string;
  /** The request: untrusted data and the task. */
  user: string;
};

/** Collapses a value onto one line so the untrusted block cannot break out of
 *  its label by starting a new line. */
export function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/* ── Shared validated shape ────────────────────────────────────────────── */

const isoDate = dateOnlySchema.nullable();

/**
 * Only web URLs are persisted and rendered as anchors. This is important
 * because the import payload is supplied by an external AI/user.
 */
export const resourceUrlSchema = z
  .string()
  .max(2000)
  .optional()
  .nullable()
  .refine((value) => {
    if (!value || value.trim() === "-") return true;
    try {
      const url = new URL(value.trim());
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Expected an http(s) URL")
  .transform((v) => (v && v.trim() && v.trim() !== "-" ? v.trim() : null));

const itemSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  resource_url: resourceUrlSchema,
  absolute_date: isoDate.optional().nullable(),
  offset_days: z.number().int().min(0).max(3650).optional().nullable(),
}).strict();

const phaseSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  items: z.array(itemSchema).min(1).max(LEARNING_PLAN_LIMITS.maxItemsPerPhase),
}).strict();

/**
 * The shape of a course.
 *
 * The plan is the learner's, but the server enforces a bounded safe envelope
 * so provider cost and action duration cannot be exhausted by one response.
 * The window and the work still decide the shape inside that envelope.
 */
export const trackSchema = z
  .object({
    track_title: z.string().trim().min(1).max(500),
    description: z.string().max(5000).optional().nullable(),
    phases: z.array(phaseSchema).min(1).max(LEARNING_PLAN_LIMITS.maxPhases),
  })
  .strict()
  .superRefine((track, ctx) => {
    const itemCount = track.phases.reduce((count, phase) => count + phase.items.length, 0);
    if (itemCount > LEARNING_PLAN_LIMITS.maxItems) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        origin: "array",
        maximum: LEARNING_PLAN_LIMITS.maxItems,
        inclusive: true,
        path: ["phases"],
        message: `A plan cannot contain more than ${LEARNING_PLAN_LIMITS.maxItems} steps`,
      });
    }
  });

export type ParsedTrack = z.infer<typeof trackSchema>;

/** A guard on the size of a raw model response, well above what the output
 *  budget can produce. */
const MAX_INPUT_LENGTH = 250_000;

export type GeneratedTrackResult =
  | { ok: true; track: ParsedTrack }
  | { ok: false; error: "invalid_json" | "invalid_track" | "invalid_dates" };

/**
 * Extracts the first complete JSON object from a model response. The model is
 * asked for JSON-only output, but this also safely handles an accidental code
 * fence or a short leading/trailing sentence without accepting partial JSON.
 */
export function extractJsonObject(raw: string): unknown | null {
  const text = raw.trim();
  if (!text || text.length > MAX_INPUT_LENGTH) return null;

  const fenced = text.match(/```[\w-]*\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidates = fenced ? [fenced, text] : [text];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // Continue with the balanced-object scan below.
    }

    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < candidate.length; index++) {
      const character = candidate[index];

      if (inString) {
        if (character === "\\") {
          escaped = !escaped;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === "{") {
        if (start === -1) {
          start = index;
          depth = 1;
        } else {
          depth++;
        }
        continue;
      }

      if (character === "}" && start !== -1) {
        depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(candidate.slice(start, index + 1));
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
          } catch {
            // Keep scanning in case prose contained an earlier brace pair.
          }
          start = -1;
        }
      }
    }
  }

  return null;
}

/** True when every dated step sits inside the selected window. */
export function generatedDatesAreInRange(
  track: ParsedTrack,
  input: LearningPlanInput
): boolean {
  for (const phase of track.phases) {
    for (const item of phase.items) {
      const hasAbsoluteDate = Boolean(item.absolute_date);
      const hasOffsetDate = item.offset_days !== null && item.offset_days !== undefined;
      if (hasAbsoluteDate === hasOffsetDate) return false;

      const targetDate = hasAbsoluteDate
        ? item.absolute_date!
        : resolveOffset(input.startDate, item.offset_days!);
      if (
        !isValidDateOnly(targetDate) ||
        targetDate < input.startDate ||
        (input.endDate !== null && input.endDate !== undefined && targetDate > input.endDate)
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Puts every step on one date representation.
 *
 * A plan with an end date is written in absolute dates; a plan without one
 * is written as offsets from the start date. Whichever the model chose, the
 * step ends up with exactly one of the two set.
 */
export function normalizeGeneratedDates(
  value: unknown,
  input: LearningPlanInput
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const track = value as Record<string, unknown>;
  if (!Array.isArray(track.phases)) return value;

  return {
    ...track,
    phases: track.phases.map((phase) => {
      if (!phase || typeof phase !== "object" || Array.isArray(phase)) return phase;
      const phaseRecord = phase as Record<string, unknown>;
      if (!Array.isArray(phaseRecord.items)) return phase;

      return {
        ...phaseRecord,
        items: phaseRecord.items.map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return item;
          const itemRecord = item as Record<string, unknown>;
          const absoluteDate = itemRecord.absolute_date;
          const offsetDays = itemRecord.offset_days;
          const hasAbsoluteDate = typeof absoluteDate === "string" && absoluteDate.length > 0;
          const hasOffsetDays = typeof offsetDays === "number" && Number.isInteger(offsetDays);

          if (hasAbsoluteDate && hasOffsetDays) {
            if (resolveOffset(input.startDate, offsetDays) !== absoluteDate) return item;
            return input.endDate
              ? { ...itemRecord, offset_days: null }
              : { ...itemRecord, absolute_date: null };
          }

          if (hasAbsoluteDate && !input.endDate && isValidDateOnly(absoluteDate)) {
            return {
              ...itemRecord,
              absolute_date: null,
              offset_days: diffDaysISO(input.startDate, absoluteDate),
            };
          }

          if (hasOffsetDays && input.endDate) {
            return {
              ...itemRecord,
              absolute_date: resolveOffset(input.startDate, offsetDays),
              offset_days: null,
            };
          }

          return item;
        }),
      };
    }),
  };
}

/**
 * Drops a stray "thinking" key.
 *
 * When a reasoning model is asked for JSON it sometimes wraps its own
 * reasoning in a "thinking" field next to the answer. The key is not part of
 * the contract, so it is removed before validation instead of failing the
 * whole plan.
 */
export function stripReasoningKey(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (!("thinking" in record)) return value;
  const { thinking: _reasoning, ...rest } = record;
  return rest;
}

/** Extracts, validates, and date-bounds a model-generated learning plan. */
export function parseGeneratedTrack(
  raw: string,
  input: LearningPlanInput
): GeneratedTrackResult {
  const json = extractJsonObject(raw);
  if (!json) return { ok: false, error: "invalid_json" };

  const parsed = trackSchema.safeParse(
    normalizeGeneratedDates(stripReasoningKey(json), input)
  );
  if (!parsed.success) return { ok: false, error: "invalid_track" };
  if (!generatedDatesAreInRange(parsed.data, input)) {
    return { ok: false, error: "invalid_dates" };
  }

  return { ok: true, track: parsed.data };
}

/** Adds offset_days to a start date → ISO date string (YYYY-MM-DD). */
export function resolveOffset(startISO: string, offsetDays: number): string {
  const d = new Date(`${startISO}T00:00:00`);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
