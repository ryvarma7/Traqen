const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createLoader } = require("./helpers/load-ts.cjs");

const loadTs = createLoader();
const {
  applyReschedule,
  buildPhaseProgress,
  focusTrack,
  moveWithinOrder,
  nextDueItem,
  nextStepByTrack,
  paceOf,
  reschedulePreview,
  upNextItem,
} = loadTs("lib/track-plan.ts");

/** A fixed "today" so the date-sensitive helpers can be reasoned about
 *  without reading the wall clock. */
const TODAY = "2026-10-21";

function makePhase(overrides = {}) {
  return {
    id: "phase-1",
    track_id: "track-1",
    position: 0,
    title: "Phase one",
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
    title: "Step one",
    description: null,
    resource_url: null,
    target_date: null,
    status: "To do",
    ...overrides,
  };
}

/** Three phases, three steps each, dated in increasing order. */
function makeTrackFixture() {
  const phases = [
    makePhase({ id: "p1", position: 0 }),
    makePhase({ id: "p2", position: 1 }),
    makePhase({ id: "p3", position: 2 }),
  ];
  const items = [
    makeItem({ id: "a1", phase_id: "p1", position: 0, target_date: "2026-10-01" }),
    makeItem({ id: "a2", phase_id: "p1", position: 1, target_date: "2026-10-03" }),
    makeItem({ id: "a3", phase_id: "p1", position: 2, target_date: "2026-10-05" }),
    makeItem({ id: "b1", phase_id: "p2", position: 0, target_date: "2026-10-07" }),
    makeItem({ id: "b2", phase_id: "p2", position: 1, target_date: "2026-10-09" }),
    makeItem({ id: "b3", phase_id: "p2", position: 2, target_date: "2026-10-11" }),
    makeItem({ id: "c1", phase_id: "p3", position: 0, target_date: "2026-10-13" }),
    makeItem({ id: "c2", phase_id: "p3", position: 1, target_date: "2026-10-15" }),
    makeItem({ id: "c3", phase_id: "p3", position: 2, target_date: "2026-10-17" }),
  ];
  return { phases, items };
}

/* ── buildPhaseProgress ──────────────────────────────────────────────────── */

test("phases are joined to their own steps and counted", () => {
  const { phases, items } = makeTrackFixture();
  const progress = buildPhaseProgress(phases, items);

  assert.equal(progress.length, 3);
  assert.equal(progress[0].total, 3);
  assert.equal(progress[0].done, 0);
  assert.equal(progress[2].index, 2);
  assert.deepEqual(
    progress[0].items.map((i) => i.id),
    ["a1", "a2", "a3"]
  );
});

test("a step's done count only counts that phase's own steps", () => {
  const { phases, items } = makeTrackFixture();
  items[0].status = "Done";
  items[1].status = "Done";

  const progress = buildPhaseProgress(phases, items);
  assert.equal(progress[0].done, 2);
  assert.equal(progress[0].total, 3);
  assert.equal(progress[1].done, 0);
});

test("the first phase with an open step is the current one", () => {
  const { phases, items } = makeTrackFixture();
  for (const item of items) {
    if (["a1", "a2", "a3"].includes(item.id)) item.status = "Done";
  }

  const progress = buildPhaseProgress(phases, items);
  assert.equal(progress[0].state, "done");
  assert.equal(progress[1].state, "current");
  assert.equal(progress[2].state, "upcoming");
});

test("a finished track has no current phase", () => {
  const { phases, items } = makeTrackFixture();
  for (const item of items) item.status = "Done";

  const progress = buildPhaseProgress(phases, items);
  assert.ok(progress.every((p) => p.state === "done"));
  assert.ok(progress.every((p) => p.state !== "current"));
});

test("a phase with no steps is upcoming and has no date range", () => {
  const phases = [makePhase({ id: "p1" }), makePhase({ id: "p2", position: 1 })];
  const items = [makeItem({ id: "a1", phase_id: "p1", target_date: "2026-10-01" })];

  const progress = buildPhaseProgress(phases, items);
  assert.equal(progress[1].state, "upcoming");
  assert.equal(progress[1].total, 0);
  assert.equal(progress[1].range, null);
});

test("a phase's date range spans its earliest and latest dated step", () => {
  const { phases, items } = makeTrackFixture();
  const progress = buildPhaseProgress(phases, items);

  assert.deepEqual(progress[0].range, { first: "2026-10-01", last: "2026-10-05" });
  assert.deepEqual(progress[2].range, { first: "2026-10-13", last: "2026-10-17" });
});

test("steps inside a phase are ordered by their stored position", () => {
  const phases = [makePhase({ id: "p1" })];
  const items = [
    makeItem({ id: "second", phase_id: "p1", position: 1 }),
    makeItem({ id: "first", phase_id: "p1", position: 0 }),
  ];

  const progress = buildPhaseProgress(phases, items);
  assert.deepEqual(
    progress[0].items.map((i) => i.id),
    ["first", "second"]
  );
});

/* ── upNextItem ──────────────────────────────────────────────────────────── */

test("the up-next step is the first open one in phase order", () => {
  const { phases, items } = makeTrackFixture();
  const progress = buildPhaseProgress(phases, items);
  assert.equal(upNextItem(progress).id, "a1");
});

test("within a phase the earliest deadline wins over the stored order", () => {
  const phases = [makePhase({ id: "p1" })];
  const items = [
    makeItem({ id: "later", phase_id: "p1", position: 0, target_date: "2026-10-20" }),
    makeItem({ id: "sooner", phase_id: "p1", position: 1, target_date: "2026-10-10" }),
  ];

  const progress = buildPhaseProgress(phases, items);
  assert.equal(upNextItem(progress).id, "sooner");
});

test("a step still sitting at In progress counts as open", () => {
  const phases = [makePhase({ id: "p1" })];
  const items = [makeItem({ id: "a1", phase_id: "p1", status: "In progress" })];

  const progress = buildPhaseProgress(phases, items);
  assert.equal(upNextItem(progress).id, "a1");
});

test("there is no up-next step once everything is done", () => {
  const { phases, items } = makeTrackFixture();
  for (const item of items) item.status = "Done";

  const progress = buildPhaseProgress(phases, items);
  assert.equal(upNextItem(progress), null);
});

test("the up-next step comes from the earliest phase that still has work", () => {
  const { phases, items } = makeTrackFixture();
  for (const item of items) {
    if (item.phase_id === "p1") item.status = "Done";
  }

  const progress = buildPhaseProgress(phases, items);
  assert.equal(upNextItem(progress).id, "b1");
});

/* ── paceOf ──────────────────────────────────────────────────────────────── */

test("pace counts an overdue open step and reports the worst days behind", () => {
  const items = [
    makeItem({ id: "a1", target_date: "2026-10-18" }),
    makeItem({ id: "a2", target_date: "2026-10-10" }),
    makeItem({ id: "a3", target_date: "2026-10-25" }),
  ];

  const pace = paceOf(items, TODAY);
  assert.equal(pace.overdueCount, 2);
  assert.equal(pace.behindDays, 11);
});

test("pace ignores a finished step even when it is overdue", () => {
  const items = [makeItem({ id: "a1", target_date: "2026-10-01", status: "Done" })];
  const pace = paceOf(items, TODAY);
  assert.equal(pace.overdueCount, 0);
  assert.equal(pace.behindDays, 0);
});

test("pace ignores steps that have no date", () => {
  const items = [makeItem({ id: "a1", target_date: null })];
  const pace = paceOf(items, TODAY);
  assert.equal(pace.overdueCount, 0);
  assert.equal(pace.behindDays, 0);
});

test("a plan that is on time reports no days behind", () => {
  const items = [
    makeItem({ id: "a1", target_date: "2026-10-21" }),
    makeItem({ id: "a2", target_date: "2026-10-30" }),
  ];
  const pace = paceOf(items, TODAY);
  assert.equal(pace.overdueCount, 0);
  assert.equal(pace.behindDays, 0);
});

/* ── nextDueItem ─────────────────────────────────────────────────────────── */

test("a future deadline is preferred over an already-overdue one", () => {
  const items = [
    makeItem({ id: "overdue", target_date: "2026-10-05" }),
    makeItem({ id: "upcoming", target_date: "2026-10-30" }),
  ];

  const due = nextDueItem(items, TODAY);
  assert.equal(due.item.id, "upcoming");
  assert.equal(due.days, 9);
});

test("when everything is overdue the least-bad one surfaces", () => {
  const items = [
    makeItem({ id: "worst", target_date: "2026-10-01" }),
    makeItem({ id: "leastBad", target_date: "2026-10-19" }),
  ];

  const due = nextDueItem(items, TODAY);
  assert.equal(due.item.id, "leastBad");
  assert.equal(due.days, -2);
});

test("a step due today counts as today, not as overdue", () => {
  const items = [makeItem({ id: "a1", target_date: TODAY })];
  const due = nextDueItem(items, TODAY);
  assert.equal(due.days, 0);
});

test("there is no next deadline when every open step is undated", () => {
  const items = [makeItem({ id: "a1", target_date: null })];
  assert.equal(nextDueItem(items, TODAY), null);
});

test("finished steps never surface as the next deadline", () => {
  const items = [makeItem({ id: "a1", target_date: "2026-10-30", status: "Done" })];
  assert.equal(nextDueItem(items, TODAY), null);
});

/* ── reschedulePreview / applyReschedule ────────────────────────────────── */

test("the reschedule preview counts the open dated steps and the shift", () => {
  const { items } = makeTrackFixture();
  const preview = reschedulePreview(items, "2026-11-01");

  assert.equal(preview.count, 9);
  assert.equal(preview.delta, 31);
});

test("the reschedule preview ignores finished and undated steps", () => {
  const items = [
    makeItem({ id: "a1", target_date: "2026-10-01" }),
    makeItem({ id: "a2", target_date: "2026-10-05", status: "Done" }),
    makeItem({ id: "a3", target_date: null }),
  ];

  const preview = reschedulePreview(items, "2026-10-11");
  assert.equal(preview.count, 1);
  assert.equal(preview.delta, 10);
});

test("there is nothing to reschedule when no open step has a date", () => {
  const items = [makeItem({ id: "a1", target_date: null })];
  const preview = reschedulePreview(items, "2026-11-01");
  assert.equal(preview.count, 0);
  assert.equal(preview.delta, 0);
});

test("the shift is zero when the new start is the current one", () => {
  const items = [makeItem({ id: "a1", target_date: "2026-10-01" })];
  const preview = reschedulePreview(items, "2026-10-01");
  assert.equal(preview.delta, 0);
});

test("every open dated step moves by the same number of days", () => {
  const { items } = makeTrackFixture();
  const shift = applyReschedule(items, "2026-11-01");

  assert.equal(shift.size, 9);
  assert.equal(shift.get("a1"), "2026-11-01");
  assert.equal(shift.get("a2"), "2026-11-03");
  assert.equal(shift.get("c3"), "2026-11-17");
});

test("a finished step keeps its date when the plan is rescheduled", () => {
  const { items } = makeTrackFixture();
  items[0].status = "Done";

  const shift = applyReschedule(items, "2026-11-01");
  assert.equal(shift.has("a1"), false);
  // The anchor is the earliest still-open dated step, so finishing a1
  // re-anchors the rest of the plan onto the new start date.
  assert.equal(shift.get("a2"), "2026-11-01");
  assert.equal(shift.get("a3"), "2026-11-03");
});

test("the shift preserves the spacing between the steps", () => {
  const { items } = makeTrackFixture();
  const shift = applyReschedule(items, "2026-11-01");

  const before = items.map((i) => i.target_date);
  const after = ["a1", "a2", "a3"].map((id) => shift.get(id));
  assert.equal(after[1] - after[0], before[1] - before[0]);
  assert.equal(after[2] - after[1], before[2] - before[1]);
});

test("a zero shift changes nothing", () => {
  const { items } = makeTrackFixture();
  const shift = applyReschedule(items, "2026-10-01");
  assert.equal(shift.size, 0);
});

/* ── nextStepByTrack ─────────────────────────────────────────────────────── */
test("each active track contributes exactly one next step", () => {
  const { phases, items } = makeTrackFixture();
  const tracks = [{ id: "track-1", status: "In progress" }];

  const next = nextStepByTrack(tracks, phases, items);
  assert.equal(next.size, 1);
  assert.equal(next.get("track-1").id, "a1");
});

test("completed and on-hold tracks contribute nothing", () => {
  const { phases, items } = makeTrackFixture();
  const tracks = [
    { id: "track-1", status: "Completed" },
    { id: "track-2", status: "On hold" },
  ];

  assert.equal(nextStepByTrack(tracks, phases, items).size, 0);
});

test("a track whose steps are all done contributes nothing", () => {
  const { phases, items } = makeTrackFixture();
  for (const item of items) item.status = "Done";

  const next = nextStepByTrack([{ id: "track-1", status: "In progress" }], phases, items);
  assert.equal(next.size, 0);
});

test("the next step matches the step the track page calls up next", () => {
  const { phases, items } = makeTrackFixture();
  for (const item of items) {
    if (item.phase_id === "p1") item.status = "Done";
  }

  const progress = buildPhaseProgress(phases, items);
  const next = nextStepByTrack([{ id: "track-1", status: "In progress" }], phases, items);
  assert.equal(next.get("track-1").id, upNextItem(progress).id);
});

test("the next step is the earliest phase's first open step, not the earliest date", () => {
  const phases = [makePhase({ id: "p1", position: 0 }), makePhase({ id: "p2", position: 1 })];
  const items = [
    makeItem({ id: "a1", phase_id: "p1", position: 0, target_date: "2026-12-01" }),
    makeItem({ id: "b1", phase_id: "p2", position: 0, target_date: "2026-10-02" }),
  ];

  const next = nextStepByTrack([{ id: "track-1", status: "In progress" }], phases, items);
  assert.equal(next.get("track-1").id, "a1");
});

test("several tracks are tracked independently", () => {
  const phases = [
    makePhase({ id: "p1", track_id: "track-1", position: 0 }),
    makePhase({ id: "q1", track_id: "track-2", position: 0 }),
  ];
  const items = [
    makeItem({ id: "a1", track_id: "track-1", phase_id: "p1" }),
    makeItem({ id: "b1", track_id: "track-2", phase_id: "q1" }),
  ];
  const tracks = [
    { id: "track-1", status: "In progress" },
    { id: "track-2", status: "In progress" },
  ];

  const next = nextStepByTrack(tracks, phases, items);
  assert.equal(next.get("track-1").id, "a1");
  assert.equal(next.get("track-2").id, "b1");
});

test("a step belonging to an unknown track is ignored", () => {
  const phases = [makePhase({ id: "p1", track_id: "track-1" })];
  const items = [makeItem({ id: "a1", track_id: "track-1", phase_id: "p1" })];
  const tracks = [{ id: "track-2", status: "In progress" }];

  assert.equal(nextStepByTrack(tracks, phases, items).size, 0);
});

/* ── moveWithinOrder ────────────────────────────────────────────────────── */

test("moving a step up swaps it with the one above it", () => {
  const order = moveWithinOrder(["a", "b", "c"], "b", "up");
  assert.deepEqual(order, ["b", "a", "c"]);
});

test("moving a step down swaps it with the one below it", () => {
  const order = moveWithinOrder(["a", "b", "c"], "b", "down");
  assert.deepEqual(order, ["a", "c", "b"]);
});

test("moving the first step up changes nothing", () => {
  assert.equal(moveWithinOrder(["a", "b", "c"], "a", "up"), null);
});

test("moving the last step down changes nothing", () => {
  assert.equal(moveWithinOrder(["a", "b", "c"], "c", "down"), null);
});

test("moving a step that is not in the list changes nothing", () => {
  assert.equal(moveWithinOrder(["a", "b", "c"], "ghost", "up"), null);
});

test("moving a step keeps the rest of the order intact", () => {
  const order = moveWithinOrder(["a", "b", "c", "d", "e"], "d", "up");
  assert.deepEqual(order, ["a", "b", "d", "c", "e"]);
});

test("moving a step does not change the list it was given", () => {
  const ids = ["a", "b", "c"];
  moveWithinOrder(ids, "b", "up");
  assert.deepEqual(ids, ["a", "b", "c"]);
});

test("a lone step has nowhere to move", () => {
  assert.equal(moveWithinOrder(["a"], "a", "up"), null);
  assert.equal(moveWithinOrder(["a"], "a", "down"), null);
});

/* ── focusTrack ─────────────────────────────────────────────────────────── */

function stepMap(entries) {
  return new Map(
    entries.map(([trackId, overrides]) => [
      trackId,
      makeItem({ id: `step-${trackId}`, track_id: trackId, ...overrides }),
    ])
  );
}

test("there is no focus track when nothing is in flight", () => {
  assert.equal(focusTrack(new Map()), null);
});

test("an overdue step wins over a step that is due tomorrow", () => {
  const focus = focusTrack(
    stepMap([
      ["track-late", { target_date: "2026-10-18" }],
      ["track-soon", { target_date: "2026-10-22" }],
    ])
  );
  assert.equal(focus.trackId, "track-late");
});

test("the soonest upcoming step wins when nothing is overdue", () => {
  const focus = focusTrack(
    stepMap([
      ["track-later", { target_date: "2026-11-20" }],
      ["track-sooner", { target_date: "2026-10-25" }],
    ])
  );
  assert.equal(focus.trackId, "track-sooner");
});

test("a step with no date comes last", () => {
  const focus = focusTrack(
    stepMap([
      ["track-undated", { target_date: null }],
      ["track-dated", { target_date: "2026-12-01" }],
    ])
  );
  assert.equal(focus.trackId, "track-dated");
});

test("the focus track is the only one when there is only one", () => {
  const focus = focusTrack(stepMap([["track-1", { target_date: null }]]));
  assert.equal(focus.trackId, "track-1");
  assert.equal(focus.item.track_id, "track-1");
});

test("two tracks with the same date resolve the same way every time", () => {
  const first = focusTrack(
    stepMap([
      ["track-b", { target_date: "2026-10-25" }],
      ["track-a", { target_date: "2026-10-25" }],
    ])
  );
  const second = focusTrack(
    stepMap([
      ["track-a", { target_date: "2026-10-25" }],
      ["track-b", { target_date: "2026-10-25" }],
    ])
  );
  assert.equal(first.trackId, second.trackId);
});
