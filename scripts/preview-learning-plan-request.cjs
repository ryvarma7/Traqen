/**
 * Prints the exact requests Traqen sends to NVIDIA NIM for a learning plan.
 *
 *   node scripts/preview-learning-plan-request.cjs
 *
 * It never touches the network and never needs an API key.
 *
 * A plan is generated in two stages, so there are two kinds of request to
 * look at: the outline, which decides the shape of the course, and the
 * enrichment, which writes the instructions for one phase's steps.
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
    if (request.startsWith("@/lib/")) {
      return loadTs(`lib/${request.slice("@/lib/".length)}.ts`);
    }
    return originalRequire(request);
  };
  mod._compile(code, filename);
  return mod.exports;
}

const { learningPlanInputSchema } = loadTs("lib/tracks/contract.ts");
const { buildOutlineMessages } = loadTs("lib/tracks/outline.ts");
const { buildEnrichMessages } = loadTs("lib/tracks/enrich.ts");
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
  ? process.env.NVIDIA_THINKING_EFFORT.trim().toLowerCase()
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

function requestFor({ system, user, thinking, effort }) {
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
    body: buildNvidiaRequestBody(MODEL, messages, { thinking, effort }),
  };
}

function print(title, text) {
  console.log(`\n${"=".repeat(78)}\n${title}\n${"=".repeat(78)}\n`);
  console.log(text);
}

function sizeOf(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `${text.length} chars (~${Math.round(text.length / 4)} tokens)`;
}

// ── Stage 1: the outline ─────────────────────────────────────────────────
const outlineMessages = buildOutlineMessages(input, { today: TODAY });
const outline = requestFor({
  system: outlineMessages.system,
  user: outlineMessages.user,
  thinking: THINKING,
  // The outline is the only stage that reasons: designing a curriculum is
  // the one part that needs the model to weigh shapes before committing.
  effort: "medium",
});

print("1. FORM INPUT (the Tracks form payload)", JSON.stringify(formInput, null, 2));

print(
  "2. OUTLINE REQUEST LINE + HEADERS (what goes over the wire)",
  [
    `POST ${outline.endpoint}`,
    ...Object.entries(outline.headers).map(([key, value]) => `${key}: ${value}`),
  ].join("\n")
);

print(
  "3. OUTLINE SYSTEM MESSAGE (the contract: role, curriculum rules, schedule context, schema, example)",
  outline.body.messages[0].content
);

print("4. OUTLINE USER MESSAGE (the untrusted user data only)", outline.body.messages[1].content);

print(
  "5. OUTLINE REQUEST BODY (exactly what fetch() sends as JSON.stringify(body))",
  JSON.stringify(outline.body, null, 2)
);

const compactMessages = buildOutlineMessages(input, { compact: true, today: TODAY });
const compact = requestFor({
  system: compactMessages.system,
  user: compactMessages.user,
  thinking: false,
  effort: EFFORT,
});
print(
  "6. COMPACT OUTLINE RETRY (fallback when the first answer is truncated or invalid)",
  JSON.stringify(compact.body, null, 2)
);

// ── Stage 2: the enrichment ──────────────────────────────────────────────
const enrichMessages = buildEnrichMessages({
  trackTitle: "Ship a deployed classifier behind a TypeScript API",
  trackDescription:
    "A hands-on course for web developers who want to ship a real model in production.",
  topic: input.topic,
  phase: {
    title: "Training and evaluating your first model",
    description:
      "You fit a tabular classifier and read its evaluation numbers. Exit criteria: you can say whether the model is good enough to ship.",
    steps: [
      {
        index: 0,
        title: "Load the tabular dataset and split it into train and test sets",
        objective:
          "Read the CSV into a dataframe, split it 80/20, and check that the label column is balanced.",
      },
      {
        index: 1,
        title: "Fit a baseline classifier and record its score",
        objective:
          "Train a logistic regression on the training split and write the accuracy down.",
      },
    ],
  },
});
const enrich = requestFor({
  system: enrichMessages.system,
  user: enrichMessages.user,
  // The course is already designed. The reasoning trace would be pure cost.
  thinking: false,
  effort: EFFORT,
});

print(
  "7. ENRICHMENT SYSTEM MESSAGE (the writing brief for one phase)",
  enrich.body.messages[0].content
);

print("8. ENRICHMENT USER MESSAGE (the phase, as untrusted data)", enrich.body.messages[1].content);

print(
  "9. ENRICHMENT REQUEST BODY (one call per phase, up to four at a time)",
  JSON.stringify(enrich.body, null, 2)
);

// ── The open-ended variant ───────────────────────────────────────────────
const openEnded = learningPlanInputSchema.parse({ ...formInput, endDate: null });
const openEndedMessages = buildOutlineMessages(openEnded, { today: TODAY });
print(
  "10. OPEN-ENDED VARIANT (no end date): the lines that differ in the system message",
  openEndedMessages.system
    .split("\n")
    .filter((line) =>
      /END DATE|AVAILABLE DAYS|offset_days|absolute_date|DATE RULES/i.test(line)
    )
    .join("\n")
);

console.log("\nSizes");
console.log(
  `  outline system : ${sizeOf(outline.body.messages[0].content)}`
);
console.log(`  outline user   : ${sizeOf(outline.body.messages[1].content)}`);
console.log(`  outline body   : ${sizeOf(outline.body)}`);
console.log(
  `  enrich system  : ${sizeOf(enrich.body.messages[0].content)}`
);
console.log(`  enrich user    : ${sizeOf(enrich.body.messages[1].content)}`);
console.log(`  enrich body    : ${sizeOf(enrich.body)}`);
console.log(
  `\nPlan size for a 12-week window: ${scale.phases} phases, ${scale.minSteps}-${scale.maxSteps} steps per phase (${scale.phases * scale.minSteps}-${scale.phases * scale.maxSteps} steps).`
);
