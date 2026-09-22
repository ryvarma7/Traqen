import { z } from "zod";

/* ─────────────────────────────────────────────────────────────────────────
 * Learning-track import contract.
 *
 * The user fills in a short form (topic, specs, timeframe, optional course
 * URL). We build a prompt they paste into any AI app. The AI returns a
 * COMPACT pipe-delimited format (~50 % fewer tokens than JSON) wrapped in a
 * code fence. parseTrackInput() detects the format (compact vs legacy JSON),
 * sanitizes fences/prose, validates, and returns a ParsedTrack.
 *
 * Compact format spec (one item per line, pipe-separated):
 *   TRACK: <title>
 *   DESC: <description>
 *   ---
 *   PHASE: <phase title>
 *   DESC: <phase description>
 *   <item title> | <description> | <url or -> | <+N or YYYY-MM-DD or ->
 *   ---
 *   PHASE: …
 * ──────────────────────────────────────────────────────────────────────── */

/** Builds the master prompt with the user's specifics baked in. */
export function buildPrompt(opts: {
  topic: string;
  specs: string;
  timeframe: string;
  courseUrl: string;
}): string {
  const lines: string[] = [
    `You are a learning-plan architect. Build a complete, realistic study track.`,
    ``,
    `TOPIC: ${opts.topic}`,
  ];
  if (opts.specs.trim()) lines.push(`REQUIREMENTS: ${opts.specs.trim()}`);
  if (opts.timeframe.trim()) lines.push(`TIMEFRAME: ${opts.timeframe.trim()}`);
  if (opts.courseUrl.trim()) {
    lines.push(
      `REFERENCE COURSE: ${opts.courseUrl.trim()}`,
      `If you can browse the web, check that URL and align the track with its syllabus. If you cannot browse, ignore it.`
    );
  }

  lines.push(
    ``,
    `Respond inside a single code block (any language tag). Use this EXACT compact format — one item per line, fields separated by " | ". No JSON, no markdown outside the code block.`,
    ``,
    `TRACK: short title of the track`,
    `DESC: one or two sentences on what this track achieves`,
    `---`,
    `PHASE: Phase 1 — Foundations`,
    `DESC: what this phase focuses on`,
    `concrete actionable step | what exactly to do | https://free-resource.com or - | +0`,
    `another step | details | - | +2`,
    `---`,
    `PHASE: Phase 2 — Building`,
    `DESC: …`,
    `step | details | https://url.com | 2025-04-10`,
    ``,
    `Field rules:`,
    `• Line 1: TRACK: title`,
    `• Line 2: DESC: description`,
    `• Phases separated by a line containing only ---`,
    `• Each phase starts with PHASE: title then DESC: description`,
    `• Items: exactly 4 pipe-separated fields → title | description | url or - | date`,
    `• Date field: "+N" = N days after start (integer ≥ 0), OR "YYYY-MM-DD" absolute date, OR "-" if undated`,
    `• URL field: a real free resource URL, or "-" if none. Never invent fake URLs.`,
    `• 3–8 phases, 3–10 items per phase. Order easy → hard. Every item is a single concrete action.`,
    `• Wrap the ENTIRE output in one code block so it is easy to copy.`,
  );

  return lines.join("\n");
}

/* ── Shared validated shape (used by both parsers) ─────────────────────── */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .nullable();

const itemSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  // Lenient: accept any non-empty string; the UI renders it as a link.
  resource_url: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() && v.trim() !== "-" ? v.trim() : null)),
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

/* ── Parsing ───────────────────────────────────────────────────────────── */

export type ParseResult =
  | { ok: true; track: ParsedTrack }
  | { ok: false; error: string };

/** Detects format (compact vs JSON) and delegates. */
export function parseTrackInput(raw: string): ParseResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Paste the plan your AI gave you first." };

  // Strip code fences if present.
  const fenced = text.match(/```[\w]*\s*\n?([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;

  // Heuristic: if it starts with { after trimming, try JSON first.
  const trimmedBody = body.trim();
  if (trimmedBody.startsWith("{")) {
    return parseTrackJson(trimmedBody);
  }
  return parseTrackCompact(body);
}

/** Parses the compact pipe-delimited format. */
function parseTrackCompact(raw: string): ParseResult {
  const lines = raw.split(/\r?\n/);

  let trackTitle = "";
  let trackDesc: string | null = null;
  const phases: { title: string; description: string | null; items: ParsedItem[] }[] = [];
  let currentPhase: { title: string; description: string | null; items: ParsedItem[] } | null =
    null;
  let expectPhaseDesc = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Phase separator
    if (/^-{3,}$/.test(trimmed)) {
      if (currentPhase && currentPhase.items.length > 0) phases.push(currentPhase);
      currentPhase = null;
      expectPhaseDesc = false;
      continue;
    }

    // Track-level fields
    if (/^TRACK:\s*/i.test(trimmed)) {
      trackTitle = trimmed.replace(/^TRACK:\s*/i, "").trim();
      continue;
    }
    if (/^DESC:\s*/i.test(trimmed) && !currentPhase) {
      trackDesc = trimmed.replace(/^DESC:\s*/i, "").trim() || null;
      continue;
    }

    // Phase header
    if (/^PHASE:\s*/i.test(trimmed)) {
      if (currentPhase && currentPhase.items.length > 0) phases.push(currentPhase);
      currentPhase = {
        title: trimmed.replace(/^PHASE:\s*/i, "").trim(),
        description: null,
        items: [],
      };
      expectPhaseDesc = true;
      continue;
    }

    // Phase description
    if (/^DESC:\s*/i.test(trimmed) && currentPhase && expectPhaseDesc) {
      currentPhase.description = trimmed.replace(/^DESC:\s*/i, "").trim() || null;
      expectPhaseDesc = false;
      continue;
    }

    // Item line: title | description | url | date
    if (currentPhase && trimmed.includes("|")) {
      const parts = trimmed.split("|").map((p) => p.trim());
      if (parts.length < 1) continue;

      const title = parts[0] || "";
      const description = parts.length > 1 && parts[1] && parts[1] !== "-" ? parts[1] : null;
      const rawUrl = parts.length > 2 ? parts[2] : null;
      const rawDate = parts.length > 3 ? parts[3] : null;

      let absolute_date: string | null = null;
      let offset_days: number | null = null;

      if (rawDate && rawDate !== "-") {
        if (/^\+\d+$/.test(rawDate)) {
          offset_days = parseInt(rawDate.slice(1), 10);
        } else if (/^\d+$/.test(rawDate)) {
          offset_days = parseInt(rawDate, 10);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          absolute_date = rawDate;
        }
      }

      currentPhase.items.push({
        title,
        description,
        resource_url: rawUrl && rawUrl !== "-" ? rawUrl : null,
        absolute_date,
        offset_days,
      });
      continue;
    }

    // Bare line inside a phase with no pipes → treat as an item title
    if (currentPhase && trimmed.length > 0) {
      currentPhase.items.push({
        title: trimmed,
        description: null,
        resource_url: null,
        absolute_date: null,
        offset_days: null,
      });
    }
  }

  // Push last phase
  if (currentPhase && currentPhase.items.length > 0) phases.push(currentPhase);

  if (!trackTitle) {
    return { ok: false, error: 'Missing "TRACK: title" on the first line.' };
  }
  if (phases.length === 0) {
    return { ok: false, error: "No phases found. Make sure each phase starts with PHASE: and has at least one item." };
  }

  const candidate = { track_title: trackTitle, description: trackDesc, phases };
  const parsed = trackSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length > 0 ? `"${issue.path.join(".")}"` : "the plan";
    return { ok: false, error: `Problem with ${where}: ${issue.message}` };
  }
  return { ok: true, track: parsed.data };
}

/** Legacy JSON parser (kept for backward compat). */
function parseTrackJson(body: string): ParseResult {
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return { ok: false, error: "No JSON object found — copy the whole answer from your AI and try again." };
  }
  const slice = body.slice(first, last + 1);

  let json: unknown;
  try {
    json = JSON.parse(slice);
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
