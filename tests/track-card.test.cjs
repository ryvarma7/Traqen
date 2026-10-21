const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const componentPath = path.join(root, "components/tracks/track-card.tsx");

/**
 * Renders the real track card with ReactDOMServer.
 *
 * The card is a presentational component on purpose — it takes a track and
 * a delete callback and reaches for no router context — so it can be
 * rendered here without an authenticated session or a DOM.
 */
function loadComponent() {
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
    return require(componentPath).TrackCard;
  } finally {
    for (const [ext, handler] of previous) {
      if (handler) Module._extensions[ext] = handler;
      else delete Module._extensions[ext];
    }
  }
}

const TrackCard = loadComponent();

function makeTrack(overrides = {}) {
  return {
    id: "track-1",
    title: "TypeScript in depth",
    description: "A hands-on course for working developers.",
    start_date: "2026-10-20",
    end_date: "2026-11-17",
    status: "In progress",
    total: 30,
    done: 12,
    nextTitle: "Implement a user registration endpoint",
    nextDate: "2026-10-24",
    ...overrides,
  };
}

function render(track = makeTrack()) {
  const html = renderToStaticMarkup(
    React.createElement(TrackCard, { track, index: 0, onDelete: () => {} })
  );
  return html;
}

test("the card shows the track's title and status", () => {
  const html = render();
  assert.match(html, /TypeScript in depth/);
  assert.match(html, /In progress/);
});

test("the card shows how far along the track is", () => {
  const html = render();
  assert.match(html, /12\/30 steps/);
  assert.match(html, />40%</);
});

test("the card shows the step to do next", () => {
  const html = render();
  assert.match(html, /Implement a user registration endpoint/);
  assert.match(html, /Next/);
});

test("a track with no next step says so", () => {
  const html = render(makeTrack({ nextTitle: null, nextDate: null, total: 0, done: 0 }));
  assert.match(html, /No steps in this track yet/);
});

test("a finished track says every step is done", () => {
  const html = render(makeTrack({ nextTitle: null, nextDate: null, done: 30 }));
  assert.match(html, /Every step in this track is done/);
});

test("the card links to the track", () => {
  const html = render();
  assert.match(html, /href="\/tracks\/track-1"/);
});

test("the delete button is always visible, not revealed by hover", () => {
  const html = render();
  const button = html.match(/<button[^>]*aria-label="Delete track[^"]*"[^>]*>/)?.[0];
  assert.ok(button, "the card must have a delete button");
  // A button that only appears on hover is invisible on a touch screen,
  // where there is no hover — and it is still tappable.
  assert.doesNotMatch(button, /opacity-0/);
  assert.doesNotMatch(button, /group-hover/);
});

test("the delete button is named after the track", () => {
  const html = render();
  assert.match(html, /aria-label="Delete track TypeScript in depth"/);
});

test("the delete button is not nested inside the track link", () => {
  const html = render();
  const link = html.match(/<a [^>]*href="\/tracks\/track-1"[\s\S]*?<\/a>/)?.[0];
  assert.ok(link, "the card must link to the track");
  assert.doesNotMatch(link, /aria-label="Delete track/);
});

test("the plan window is shown", () => {
  const html = render();
  assert.match(html, /Oct 20/);
  assert.match(html, /Nov 17/);
});

test("a track with no end date shows only its start", () => {
  const html = render(makeTrack({ end_date: null }));
  assert.match(html, /Oct 20/);
  assert.doesNotMatch(html, /Nov 17/);
});
