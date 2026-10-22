/**
 * Live check of the learning-plan generation: mirrors the Tracks action.
 *
 *   node scripts/smoke-plan-repeat.cjs [runs]
 *
 * For each run it makes the outline attempt, and on a timeout or a contract
 * mismatch it makes the compact outline retry, exactly like
 * lib/actions/tracks.ts. It then enriches every phase, exactly like the
 * action does.
 *
 * This is the script to run when changing the prompt, the plan size or the
 * time budgets: it reports how big the plan came out, how long each stage
 * took, and how many phases failed to enrich.
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const runs = Number(process.argv[2] || 3);

for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  // A real environment variable wins over .env.local.
  if (match && process.env[match[1]] === undefined) {
    process.env[match[1]] = match[2];
  }
}

function loadTs(relative) {
  const filename = path.resolve(root, relative);
  const source = fs.readFileSync(filename, "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = (request) => {
    if (request.startsWith("@/lib/")) {
      return loadTs(`lib/${request.slice("@/lib/".length)}.ts`);
    }
    return originalRequire(request);
  };
  mod._compile(code, filename);
  return mod.exports;
}

const { generateNvidiaText } = loadTs("lib/nvidia.ts");
const { learningPlanInputSchema, trackSchema } = loadTs("lib/tracks/contract.ts");
const { buildOutlineMessages, parseOutline } = loadTs("lib/tracks/outline.ts");
const { buildEnrichMessages, mergeEnrichment, parseEnrichment } = loadTs("lib/tracks/enrich.ts");

// The same budgets the action uses.
const OUTLINE_TIMEOUT_MS = 160_000;
const COMPACT_OUTLINE_TIMEOUT_MS = 30_000;
const ENRICH_TIMEOUT_MS = 30_000;
const ENRICH_STAGGER_MS = 200;

const input = learningPlanInputSchema.parse({
  topic: "Machine learning for web developers",
  specs:
    "Two portfolio projects (one tabular classifier, one deployed model behind an API). Weekly checkpoints.",
  timeframe: "Twelve weeks",
  startDate: "2026-10-21",
  endDate: "2027-01-11",
});

console.log(
  `Plan size for a 12-week window: the model decides — the window and the topic set the shape.`
);
console.log("");

async function runOutline() {
  for (const compact of [false, true]) {
    const started = Date.now();
    try {
      const { system, user } = buildOutlineMessages(input, { compact });
      const raw = await generateNvidiaText(user, {
        system,
        thinking: compact ? false : undefined,
        effort: compact ? undefined : "medium",
        timeoutMs: compact ? COMPACT_OUTLINE_TIMEOUT_MS : OUTLINE_TIMEOUT_MS,
      });
      const parsed = parseOutline(raw, input);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (parsed.ok) {
        return { outline: parsed.outline, label: `outline ${compact ? "compact" : "full"}`, seconds };
      }
      console.log(`  outline (${compact ? "compact" : "full"}): INVALID ${parsed.error} — ${seconds}s`);
    } catch (error) {
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`  outline (${compact ? "compact" : "full"}): ERROR ${error.code} — ${seconds}s`);
    }
  }
  return null;
}

async function runEnrichment(outline) {
  const briefs = outline.phases.map((phase) => ({
    title: phase.title,
    description: phase.description,
    steps: phase.items.map((item, index) => ({
      index,
      title: item.title,
      objective: item.description ?? item.title,
    })),
  }));

  const started = Date.now();
  const results = await Promise.all(
    briefs.map(async (phase, index) => {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, ENRICH_STAGGER_MS * index));
      }
      try {
        const { system, user } = buildEnrichMessages({
          trackTitle: outline.track_title,
          trackDescription: outline.description ?? null,
          topic: input.topic,
          phase,
        });
        const raw = await generateNvidiaText(user, {
          system,
          thinking: false,
          timeoutMs: ENRICH_TIMEOUT_MS,
        });
        const parsed = parseEnrichment(raw);
        return parsed.ok ? parsed.steps : null;
      } catch {
        return null;
      }
    })
  );

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const { track, failedPhases } = mergeEnrichment(outline, results);
  return { track, failedPhases, seconds };
}

(async () => {
  let ok = 0;
  for (let index = 0; index < runs; index += 1) {
    const started = Date.now();
    let outcome = "FAILED";

    const outlined = await runOutline();
    if (outlined) {
      const enriched = await runEnrichment(outlined.outline);
      const validated = trackSchema.safeParse(enriched.track);
      if (validated.success) {
        const steps = validated.data.phases.reduce(
          (total, phase) => total + phase.items.length,
          0
        );
        outcome = `OK — ${validated.data.phases.length} phases, ${steps} steps, ${enriched.failedPhases} phases failed to enrich`;
        ok += 1;
      } else {
        outcome = `INVALID final validation (${validated.error.issues.length} issues)`;
      }
      console.log(
        `  ${outlined.label} in ${outlined.seconds}s, enrichment in ${enriched.seconds}s`
      );
    }

    console.log(
      `run ${index + 1}: ${outcome} — total ${((Date.now() - started) / 1000).toFixed(1)}s`
    );
  }
  console.log(`\n${ok}/${runs} produced a valid plan`);
})();
