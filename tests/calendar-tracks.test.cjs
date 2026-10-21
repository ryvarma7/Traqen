const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createLoader } = require("./helpers/load-ts.cjs");

const loadTs = createLoader();
const { buildCalendarEvents, groupByDate, sourceLabel } = loadTs("lib/calendar.ts");

const emptyInput = {
  tasks: [],
  jobs: [],
  hackathons: [],
  trackItems: [],
  trackTitles: new Map(),
};

function trackItem(overrides = {}) {
  return {
    id: "step-1",
    track_id: "track-1",
    title: "Read the chapter",
    status: "To do",
    target_date: "2026-10-21",
    ...overrides,
  };
}

test("a dated course step becomes a course-step event", () => {
  const events = buildCalendarEvents({
    ...emptyInput,
    trackItems: [trackItem()],
    trackTitles: new Map([["track-1", "TypeScript in depth"]]),
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].source, "track");
  assert.equal(events[0].meta, "Course step");
  assert.equal(events[0].date, "2026-10-21");
  assert.equal(events[0].title, "TypeScript in depth · Read the chapter");
  assert.equal(events[0].href, "/tracks/track-1");
  assert.equal(events[0].done, false);
});

test("a finished course step is marked done", () => {
  const events = buildCalendarEvents({
    ...emptyInput,
    trackItems: [trackItem({ status: "Done" })],
  });
  assert.equal(events[0].done, true);
});

test("an undated course step never reaches the calendar", () => {
  const events = buildCalendarEvents({
    ...emptyInput,
    trackItems: [trackItem({ target_date: null })],
  });
  assert.equal(events.length, 0);
});

test("two course steps in one track keep distinct ids even when they share a title", () => {
  const events = buildCalendarEvents({
    ...emptyInput,
    trackItems: [
      trackItem({ id: "step-1", title: "Review the chapter" }),
      trackItem({ id: "step-2", title: "Review the chapter" }),
    ],
  });

  assert.equal(events.length, 2);
  assert.notEqual(events[0].id, events[1].id);
  // Every event id has to be unique: they are used as React keys in the
  // month grid and the agenda list.
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
});

test("a course step with an unknown track still renders", () => {
  const events = buildCalendarEvents({
    ...emptyInput,
    trackItems: [trackItem({ track_id: "ghost" })],
    trackTitles: new Map(),
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "Track · Read the chapter");
});

test("course steps are grouped under their own date", () => {
  const events = buildCalendarEvents({
    ...emptyInput,
    trackItems: [
      trackItem({ id: "step-1", target_date: "2026-10-21" }),
      trackItem({ id: "step-2", target_date: "2026-10-22" }),
    ],
  });

  const grouped = groupByDate(events);
  assert.equal(grouped.get("2026-10-21").length, 1);
  assert.equal(grouped.get("2026-10-22").length, 1);
});

test("course steps are labelled as course steps in the legend", () => {
  assert.equal(sourceLabel.track, "Course step");
});

test("a task and a course step on the same day stay separate events", () => {
  const events = buildCalendarEvents({
    ...emptyInput,
    tasks: [
      { id: "task-1", title: "Email the tutor", status: "To do", due_date: "2026-10-21" },
    ],
    trackItems: [trackItem({ id: "step-1" })],
  });

  assert.equal(events.length, 2);
  assert.equal(new Set(events.map((e) => e.id)).size, 2);
  assert.equal(groupByDate(events).get("2026-10-21").length, 2);
});
