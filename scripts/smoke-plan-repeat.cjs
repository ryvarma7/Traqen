/**
 * Live check of the learning-plan generation: mirrors the Tracks action.
 *
 *   node scripts/smoke-plan-repeat.cjs [runs]
 *
 * For each run it makes the full attempt, and on a timeout or a contract
 * mismatch it makes the compact retry, exactly like lib/actions/tracks.ts.
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
    if (request === "@/lib/dates") return loadTs("lib/dates.ts");
    return originalRequire(request);
  };
  mod._compile(code, filename);
  return mod.exports;
}

const { generateNvidiaText } = loadTs("lib/nvidia.ts");
const { buildLearningPlanMessages, learningPlanInputSchema, parseGeneratedTrack } =
  loadTs("lib/tracks/contract.ts");

const REASONED_TIMEOUT_MS = 170_000;
const COMPACT_RETRY_TIMEOUT_MS = 60_000;

const input = learningPlanInputSchema.parse({
  topic: "Machine learning for web developers",
  specs:
    "Two portfolio projects (one tabular classifier, one deployed model behind an API). Weekly checkpoints.",
  timeframe: "Twelve weeks",
  startDate: "2026-10-21",
  endDate: "2027-01-11",
});

(async () => {
  let ok = 0;
  for (let index = 0; index < runs; index += 1) {
    const started = Date.now();
    let outcome = "FAILED";

    for (const compact of [false, true]) {
      const { system, user } = buildLearningPlanMessages(input, { compact });
      try {
        const raw = await generateNvidiaText(user, {
          system,
          timeoutMs: compact ? COMPACT_RETRY_TIMEOUT_MS : REASONED_TIMEOUT_MS,
        });
        const parsed = parseGeneratedTrack(raw, input);
        if (parsed.ok) {
          const phases = parsed.track.phases.length;
          const steps = parsed.track.phases.reduce(
            (total, phase) => total + phase.items.length,
            0
          );
          outcome = `OK (${compact ? "compact" : "full"}) — ${phases} phases, ${steps} steps, ${raw.length} chars`;
          ok += 1;
          break;
        }
        outcome = `INVALID ${parsed.error} (${compact ? "compact" : "full"})`;
      } catch (error) {
        outcome = `ERROR ${error.code} (${compact ? "compact" : "full"})`;
      }
    }

    console.log(
      `run ${index + 1}: ${outcome} — total ${((Date.now() - started) / 1000).toFixed(1)}s`
    );
  }
  console.log(`\n${ok}/${runs} produced a valid plan`);
})();
