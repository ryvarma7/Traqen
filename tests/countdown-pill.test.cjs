const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

/**
 * Loads a TSX module straight from the repo, the same way the other suites
 * do: transpiled in memory with the installed TypeScript, with "@/" resolved
 * back to the repository root. The components under test are real — so are
 * the countdown pill they share.
 */
function loadModule(relativePath) {
  const modulePath = path.join(root, relativePath);
  const previous = new Map([".ts", ".tsx"].map((ext) => [ext, Module._extensions[ext]]));
  const compile = (mod, filename) => {
    const originalRequire = mod.require.bind(mod);
    mod.require = (specifier) => {
      return originalRequire(
        specifier.startsWith("@/")
          ? path.join(root, specifier.slice(2))
          : specifier
      );
    };
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    mod._compile(outputText, filename);
  };
  try {
    for (const [ext, handler] of previous) Module._extensions[ext] = compile;
    return require(modulePath);
  } finally {
    for (const [ext, handler] of previous) {
      if (handler) Module._extensions[ext] = handler;
      else delete Module._extensions[ext];
    }
  }
}

const { CountdownPill, countdownShowsDate } = loadModule(
  "components/shared/countdown-pill.tsx"
);
const { TrackTaskRow } = loadModule("components/tracks/track-task-row.tsx");
const { UpNextCard } = loadModule("components/tracks/up-next-card.tsx");

/** A date a given number of days from today, in the "YYYY-MM-DD" form the
 *  app stores. Local-time arithmetic so it matches daysUntil(). */
function dateIn(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function makeItem(targetDate) {
  return {
    id: "item-1",
    track_id: "track-1",
    phase_id: "phase-1",
    position: 1,
    title: "Read the chapter on retries",
    description: null,
    resource_url: null,
    target_date: targetDate,
    status: "To do",
  };
}

function renderRow(targetDate) {
  return renderToStaticMarkup(
    React.createElement(TrackTaskRow, {
      item: makeItem(targetDate),
      onToggle: () => {},
    })
  );
}

function renderUpNext(targetDate) {
  return renderToStaticMarkup(
    React.createElement(UpNextCard, {
      item: makeItem(targetDate),
      phase: null,
      totalItems: 1,
      onMarkDone: () => {},
    })
  );
}

/** How many times a short date label appears in the rendered markup. */
function occurrencesOf(html, label) {
  return html.split(label).length - 1;
}

test("a near date counts down in the pill", () => {
  const html = renderToStaticMarkup(
    React.createElement(CountdownPill, { date: dateIn(7) })
  );
  assert.match(html, /7d left/);
});

test("a date more than a week out shows the date in the pill", () => {
  const html = renderToStaticMarkup(
    React.createElement(CountdownPill, { date: dateIn(12) })
  );
  assert.match(html, /[A-Z][a-z]{2} \d{1,2}/);
  assert.doesNotMatch(html, /d left/);
});

test("countdownShowsDate flips only past the countdown window", () => {
  assert.equal(countdownShowsDate(dateIn(7)), false);
  assert.equal(countdownShowsDate(dateIn(8)), true);
  assert.equal(countdownShowsDate(dateIn(30)), true);
});

test("a step within a week shows the countdown and the date together", () => {
  const target = dateIn(3);
  const html = renderRow(target);
  const label = new Date(`${target}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  assert.match(html, /3d left/);
  assert.equal(occurrencesOf(html, "3d left"), 1);
  assert.equal(occurrencesOf(html, label), 1);
});

test("a step more than a week out does not print the date twice", () => {
  const target = dateIn(20);
  const html = renderRow(target);
  const label = new Date(`${target}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  assert.equal(
    occurrencesOf(html, label),
    1,
    "the date is shown once, inside the pill — not again beside it"
  );
});

test("the up-next card does not print the date twice either", () => {
  const target = dateIn(20);
  const html = renderUpNext(target);
  const label = new Date(`${target}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  assert.equal(occurrencesOf(html, label), 1);
  assert.match(html, /in 20 days/);
});

test("the up-next card keeps the date and the countdown together within a week", () => {
  const target = dateIn(4);
  const html = renderUpNext(target);
  const label = new Date(`${target}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  assert.match(html, /4d left/);
  assert.equal(occurrencesOf(html, label), 1);
  assert.match(html, /in 4 days/);
});
