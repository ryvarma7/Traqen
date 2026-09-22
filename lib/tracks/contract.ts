import { z } from "zod";

/* ─────────────────────────────────────────────────────────────────────────
 * Learning-track import contract.
 *
 * The user plans a course in any external AI app using MASTER_PROMPT below,
 * then pastes the AI's JSON answer into Traqen. parseTrackJson() sanitizes
 * (fences, prose around the JSON) and validates against trackSchema.
 * Every item carries EITHER absolute_date OR offset_days (days from the
 * track start) — the import wizard resolves offsets against the start date.
 * ──────────────────────────────────────────────────────────────────────── */

export const MASTER_PROMPT = `You are a learning-plan architect. Create a complete, realistic study track for me.

Respond with ONLY raw JSON — no markdown fences, no commentary, no text before or after. Use this exact shape:

{
  "track_title": "short title of the track",
  "description": "one or two sentences on what this track achieves",
  "phases": [
    {
      "title": "Phase name, e.g. Phase 1 — Foundations",
      "description": "what this phase focuses on",
      "items": [
        {
          "title": "concrete, actionable step",
          "description": "what exactly to do and what to produce",
          "resource_url": "a real free resource URL or null",
          "absolute_date": "YYYY-MM-DD or null",
          "offset_days": 1
        }
      ]
    }
  ]
}

Hard rules:
1. Output must be a single valid JSON object. Nothing else.
2. Dates: if I gave you concrete dates, use "absolute_date" (ISO YYYY-MM-DD) and set "offset_days" to null. Otherwise use "offset_days" = days after my start day (first item is usually 0 or 1) and set "absolute_date" to null. Never fill both.
3. 3–8 phases, 3–10 items per phase. Order phases logically, easy to hard.
4. Every item must be a single concrete action (read, build, practice, quiz), not vague advice.
5. Use strings, numbers, arrays and objects only — no trailing commas, no comments.

My request:`;

/* ── Zod schema — tolerant of what real AI output looks like ────────────── */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .nullable();

const itemSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  resource_url: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  absolute_date: isoDate.optional().nullable(),
  offset_days: z.number().int().min(0).max(3650).optional().nullable(),
});

const phaseSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  items: z.array(itemSchema).min(1),
});

export const trackSchema = z.object({
  track_title: z.string().trim().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  phases: z.array(phaseSchema).min(1),
});

export type ParsedTrack = z.infer<typeof trackSchema>;
export type ParsedItem = z.infer<typeof itemSchema>;

/* ── Parsing ────────────────────────────────────────────────────────────── */

export type ParseResult =
  | { ok: true; track: ParsedTrack }
  | { ok: false; error: string };

/** Strips markdown fences / surrounding prose, finds the outermost JSON
 *  object, parses and validates it against the contract. */
export function parseTrackJson(raw: string): ParseResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Paste the JSON your AI gave you first." };

  // Strip ```json … ``` fences if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = fenced ? fenced[1] : text;

  // Narrow to the outermost { … } block (AI models love adding prose).
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return { ok: false, error: "No JSON object found — copy the whole answer from your AI and try again." };
  }
  body = body.slice(first, last + 1);

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return {
      ok: false,
      error: "That isn't valid JSON. Ask your AI to fix it, or paste the whole answer again.",
    };
  }

  const parsed = trackSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length > 0 ? `"${issue.path.join(".")}"` : "the plan";
    return { ok: false, error: `Problem with ${where}: ${issue.message}` };
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
