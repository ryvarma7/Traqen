const assert = require("node:assert/strict");
const { test } = require("node:test");
const loadTs = require("./performance/load-ts.cjs");
const { originalPaint } = require("./performance/original-contours.cjs");
const { createFrameScheduler } = loadTs("lib/frame-scheduler.ts");
const { blurIn, itemVariants, listVariants, listItemTransition } = loadTs("lib/motion.ts");

test("a burst of scroll/resize events performs at most one read per frame", () => {
  let next = 0, reads = 0;
  const pending = new Map();
  const scheduler = createFrameScheduler(() => reads++, (cb) => { pending.set(++next, cb); return next; }, (id) => pending.delete(id));
  for (let i = 0; i < 200; i++) scheduler.schedule();
  assert.equal(pending.size, 1);
  const flush = () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach((callback) => callback(16)); };
  flush();
  assert.equal(reads, 1);
  scheduler.schedule();
  flush();
  assert.equal(reads, 2);
  scheduler.schedule();
  scheduler.cancel();
  flush();
  assert.equal(reads, 2, "Unmount cleanup cancels the pending layout read");
  scheduler.schedule();
  flush();
  assert.equal(reads, 3, "Scheduling still works after cancellation");
});

test("list entrances are capped at 500ms including their last item's animation", () => {
  assert.equal(listVariants.visible.transition, undefined);
  for (const index of [0, 1, 5, 119, 9999]) {
    const transition = listItemTransition(index);
    assert.ok(transition.delay + transition.duration <= 0.5);
    assert.equal(transition.layout.delay, undefined, "Reorders do not inherit entrance delays");
    assert.equal(itemVariants.visible(index).filter, "none");
  }
  assert.equal(listItemTransition(1).delay, 0.05);
  assert.equal(listItemTransition(-1).delay, 0);
  assert.equal(blurIn.animate.filter, "none", "Settled surfaces release their blur layers");
});

function recordingContext() {
  const commands = [];
  return { commands, globalAlpha: 1,
    clearRect(...args) { commands.push(["clear", ...args]); },
    beginPath() { commands.push(["begin", this.globalAlpha]); },
    moveTo(...args) { commands.push(["move", ...args]); },
    lineTo(...args) { commands.push(["line", ...args]); },
    stroke() { commands.push(["stroke"]); },
  };
}

test("cached contour math preserves every ring, vertex and brightness", () => {
  const { paintAuthContours } = loadTs("lib/auth-contours.ts");
  for (const [w, h] of [[375, 812], [1440, 900], [2560, 1440]]) {
    for (const time of [0, 1200, 16000, 60000]) {
      const expected = recordingContext(), actual = recordingContext();
      originalPaint(expected, w, h, time);
      paintAuthContours(actual, w, h, time);
      assert.equal(actual.commands.length, expected.commands.length);
      actual.commands.forEach((command, i) => command.forEach((value, j) => {
        if (typeof value === "number") assert.ok(Math.abs(value - expected.commands[i][j]) < 1e-8, `vertex ${i}/${j}`);
        else assert.equal(value, expected.commands[i][j]);
      }));
      assert.equal(actual.globalAlpha, 1);
    }
  }
});

test("contour frames use 24 trig calls rather than 5,733", () => {
  let calls = 0;
  const math = Object.create(Math);
  math.sin = (x) => { calls++; return Math.sin(x); };
  math.cos = (x) => { calls++; return Math.cos(x); };
  const { paintAuthContours } = loadTs("lib/auth-contours.ts", { Math: math });
  calls = 0; // Exclude the one-time angular cache initialization.
  paintAuthContours(recordingContext(), 1440, 900, 1200);
  assert.equal(calls, 24);
});
