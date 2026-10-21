/**
 * Prints the exact request Traqen sends to NVIDIA NIM for a learning plan.
 *
 *   node scripts/preview-learning-plan-request.cjs
 *
 * It never touches the network and never needs an API key.
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

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

const {
  buildLearningPlanMessages,
  learningPlanInputSchema,
} = loadTs("lib/tracks/contract.ts");
const { buildNvidiaRequestBody } = loadTs("lib/nvidia.ts");

const MODEL = process.env.NVIDIA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
const TODAY = process.env.PREVIEW_TODAY || "2026-10-21";
// The reasoning trace and the effort are on by default; NVIDIA_THINKING=off
// and NVIDIA_THINKING_EFFORT=medium|low change that.
const THINKING_VALUE = (process.env.NVIDIA_THINKING || "").trim().toLowerCase();
const THINKING = !(THINKING_VALUE === "off" || THINKING_VALUE === "false" || THINKING_VALUE === "0");
const EFFORT = ["medium", "low"].includes(
  (process.env.NVIDIA_THINKING_EFFORT || "").trim().toLowerCase()
)
  ? (process.env.NVIDIA_THINKING_EFFORT || "").trim().toLowerCase()
  : "full";

// ── Test data, as the Tracks form would send it ──────────────────────────
const formInput = {
  topic: "Machine learning for web developers",
  specs:
    "Two portfolio projects (one tabular classifier, one deployed model behind an API). Weekly checkpoints, and one reading from the official scikit-learn docs per week.",
  timeframe: "Twelve weeks",
  startDate: "2026-10-21",
  endDate: "2027-01-11",
};

const input = learningPlanInputSchema.parse(formInput);

function requestFor({ compact = false, thinking = THINKING, planInput = input } = {}) {
  const { system, user } = buildLearningPlanMessages(planInput, { compact, today: TODAY });
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  return {
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: "Bearer <NVIDIA_API_KEY>",
    },
    body: buildNvidiaRequestBody(MODEL, messages, { thinking, effort: EFFORT }),
  };
}

function print(title, text) {
  console.log(`\n${"=".repeat(78)}\n${title}\n${"=".repeat(78)}\n`);
  console.log(text);
}

const main = requestFor();

print("1. FORM INPUT (the Tracks form payload)", JSON.stringify(formInput, null, 2));

print(
  "2. REQUEST LINE + HEADERS (what goes over the wire)",
  [
    `POST ${main.endpoint}`,
    ...Object.entries(main.headers).map(([key, value]) => `${key}: ${value}`),
  ].join("\n")
);

print(
  "3. SYSTEM MESSAGE (the contract: role, curriculum rules, schedule context, schema, example)",
  main.body.messages[0].content
);

print("4. USER MESSAGE (the untrusted user data only)", main.body.messages[1].content);

print(
  "5. FULL REQUEST BODY (exactly what fetch() sends as JSON.stringify(body))",
  JSON.stringify(main.body, null, 2)
);

const compact = requestFor({ compact: true });
print(
  "6. COMPACT RETRY BODY (fallback when the first answer is truncated or invalid)",
  JSON.stringify(compact.body, null, 2)
);

const openEnded = learningPlanInputSchema.parse({ ...formInput, endDate: null });
const openEndedMessages = buildLearningPlanMessages(openEnded, { today: TODAY });
print(
  "7. OPEN-ENDED VARIANT (no end date): the lines that differ in the system message",
  openEndedMessages.system
    .split("\n")
    .filter((line) =>
      /END DATE|AVAILABLE DAYS|offset_days|absolute_date|DATE RULES/i.test(line)
    )
    .join("\n")
);

console.log(
  `\nSizes — system: ${main.body.messages[0].content.length} chars, user: ${main.body.messages[1].content.length} chars, body: ${JSON.stringify(main.body).length} chars (~${Math.round(JSON.stringify(main.body).length / 4)} tokens)`
);
