const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadWithState, propsText } = require("./helpers/state-replay.cjs");

/**
 * How a track page reads: the up-next card at the top, the phase stepper
 * under the header, and the plan of phases below them.
 *
 * Three things are checked here, all of them about what the learner reads
 * rather than how it is painted:
 *
 * - the phase is named once, not twice;
 * - the stepper keeps a phase's whole name;
 * - finished steps are folded away instead of taking up a screen each.
 */

const { exports: upNext, render: renderUpNext } = loadWithState(
  "components/tracks/up-next-card.tsx"
);
const { exports: stepper, render: renderStepper } = loadWithState(
  "components/tracks/track-phase-stepper.tsx"
);
const { exports: phaseList, render: renderPhaseList } = loadWithState(
  "components/tracks/phase-list.tsx"
);

const PHASE_TITLE = "Foundations of Machine Learning";

function makePhase(overrides = {}) {
  return {
    id: "phase-1",
    track_id: "track-1",
    position: 0,
    title: PHASE_TITLE,
    description: null,
    ...overrides,
  };
}

function makeItem(overrides = {}) {
  return {
    id: "item-1",
    track_id: "track-1",
    phase_id: "phase-1",
    position: 0,
    title: "Read the chapter on retries",
    description: null,
    resource_url: null,
    target_date: null,
    status: "To do",
    ...overrides,
  };
}

function makeProgress(items, phase = makePhase()) {
  const done = items.filter((item) => item.status === "Done").length;
  return {
    phase,
    index: 0,
    items,
    done,
    total: items.length,
    state: done === items.length && items.length > 0 ? "done" : "current",
    range: null,
  };
}

/** How many times a phrase appears in a chunk of markup. */
function occurrencesOf(html, phrase) {
  return html.split(phrase).length - 1;
}

/** The words a reader sees: the markup with the tags taken out. */
function visibleText(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

test("the up-next card names the phase when the plan below does not", () => {
  const view = renderUpNext(upNext.UpNextCard, {
    item: makeItem(),
    phase: makePhase(),
    showPhaseLabel: true,
    totalItems: 1,
    onMarkDone: () => {},
  });
  assert.match(view.html, /Foundations of Machine Learning/);
});

test("the up-next card drops a phase name the plan already shows", () => {
  const view = renderUpNext(upNext.UpNextCard, {
    item: makeItem(),
    phase: makePhase(),
    showPhaseLabel: false,
    totalItems: 1,
    onMarkDone: () => {},
  });
  assert.doesNotMatch(view.html, /Foundations of Machine Learning/);
});

test("the phase is named once across the card and the plan", () => {
  const items = [makeItem()];

  const card = renderUpNext(upNext.UpNextCard, {
    item: items[0],
    phase: makePhase(),
    showPhaseLabel: false,
    totalItems: items.length,
    onMarkDone: () => {},
  });
  const plan = renderPhaseList(phaseList.PhaseTasks, {
    progress: makeProgress(items),
    busyIds: new Set(),
    onItemToggle: () => {},
    unfoldedPhaseIds: new Set(),
    onToggleUnfolded: () => {},
  });

  assert.equal(
    occurrencesOf(visibleText(card.html + plan.html), PHASE_TITLE),
    1,
    "the phase is named by the plan, so the card must not name it again"
  );
});

test("the stepper keeps a phase's whole name", () => {
  const view = renderStepper(stepper.TrackPhaseStepper, {
    progress: [makeProgress([makeItem()])],
    selectedId: "phase-1",
    onSelect: () => {},
  });
  // The name is in the markup in full, and once more as the button's title,
  // so a name too long for the label is still readable on hover and to a
  // screen reader.
  assert.match(view.html, /Foundations of Machine Learning/);
  assert.match(view.html, /title="Foundations of Machine Learning"/);
});

test("a finished step is folded into the phase's count", () => {
  const items = [
    makeItem({ id: "open-1", title: "Read the chapter on retries" }),
    makeItem({ id: "done-1", title: "Set up the environment", status: "Done" }),
  ];

  const view = renderPhaseList(phaseList.PhaseTasks, {
    progress: makeProgress(items),
    busyIds: new Set(),
    onItemToggle: () => {},
    unfoldedPhaseIds: new Set(),
    onToggleUnfolded: () => {},
  });

  assert.match(view.html, /Read the chapter on retries/);
  assert.doesNotMatch(view.html, /Set up the environment/);
  assert.match(view.html, /1 completed step/);
});

test("the fold asks the page to unfold that phase", () => {
  const items = [
    makeItem({ id: "open-1", title: "Read the chapter on retries" }),
    makeItem({ id: "done-1", title: "Set up the environment", status: "Done" }),
    makeItem({
      id: "done-2",
      title: "Run the first example",
      status: "Done",
    }),
  ];

  const asked = [];
  const view = renderPhaseList(phaseList.PhaseTasks, {
    progress: makeProgress(items),
    busyIds: new Set(),
    onItemToggle: () => {},
    unfoldedPhaseIds: new Set(),
    onToggleUnfolded: (phaseId) => asked.push(phaseId),
  });

  assert.match(view.html, /2 completed steps/);

  view.click((props) => propsText(props).includes("2 completed steps"));

  assert.deepEqual(asked, ["phase-1"]);
});

test("an unfolded phase shows its finished steps again", () => {
  const items = [
    makeItem({ id: "open-1", title: "Read the chapter on retries" }),
    makeItem({ id: "done-1", title: "Set up the environment", status: "Done" }),
    makeItem({
      id: "done-2",
      title: "Run the first example",
      status: "Done",
    }),
  ];

  const view = renderPhaseList(phaseList.PhaseTasks, {
    progress: makeProgress(items),
    busyIds: new Set(),
    onItemToggle: () => {},
    unfoldedPhaseIds: new Set(["phase-1"]),
    onToggleUnfolded: () => {},
  });

  assert.match(view.html, /Set up the environment/);
  assert.match(view.html, /Run the first example/);
  assert.match(view.html, /Read the chapter on retries/);
});

test("a phase with nothing done has no fold to open", () => {
  const items = [makeItem({ id: "open-1", title: "Read the chapter on retries" })];

  const view = renderPhaseList(phaseList.PhaseTasks, {
    progress: makeProgress(items),
    busyIds: new Set(),
    onItemToggle: () => {},
    unfoldedPhaseIds: new Set(),
    onToggleUnfolded: () => {},
  });

  assert.doesNotMatch(view.html, /completed step/);
  assert.equal(
    view.buttons.filter((props) => "aria-expanded" in props).length,
    0,
    "there is no fold to expand"
  );
});

test("the mobile accordion folds finished steps too", () => {
  const items = [
    makeItem({ id: "open-1", title: "Read the chapter on retries" }),
    makeItem({ id: "done-1", title: "Set up the environment", status: "Done" }),
  ];

  const view = renderPhaseList(phaseList.PhaseAccordion, {
    progress: [makeProgress(items)],
    openId: "phase-1",
    onSelect: () => {},
    busyIds: new Set(),
    onItemToggle: () => {},
    unfoldedPhaseIds: new Set(),
    onToggleUnfolded: () => {},
  });

  assert.match(view.html, /Read the chapter on retries/);
  assert.doesNotMatch(view.html, /Set up the environment/);
  assert.match(view.html, /1 completed step/);
});

test("the up-next card still shows the phase when there is no other copy", () => {
  // The card on its own, with no plan under it: the phase name is the only
  // context the step has, so it stays.
  const view = renderUpNext(upNext.UpNextCard, {
    item: makeItem(),
    phase: makePhase(),
    totalItems: 1,
    onMarkDone: () => {},
  });
  assert.match(view.html, /Foundations of Machine Learning/);
});
