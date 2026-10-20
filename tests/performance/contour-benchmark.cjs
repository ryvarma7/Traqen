const { performance } = require("node:perf_hooks");
const loadTs = require("./load-ts.cjs");
const { originalPaint } = require("./original-contours.cjs");
// Both functions run in this realm so sandbox Math lookup costs cannot skew it.
const { paintAuthContours } = loadTs("lib/auth-contours.ts", {}, true);
const baselinePaint = originalPaint;
let sink = 0;
const context = { clearRect() {}, beginPath() {}, stroke() {}, globalAlpha: 1,
  moveTo(x, y) { sink += x * 0.0001 + y * 0.0001; }, lineTo(x, y) { sink += x * 0.0001 + y * 0.0001; } };
const run = (paint) => {
  const start = performance.now();
  for (let frame = 0; frame < 600; frame++) paint(context, 1440, 900, frame * 16.667);
  return performance.now() - start;
};
run(baselinePaint); run(paintAuthContours);
const samples = [];
for (let i = 0; i < 5; i++) {
  // Alternate order to reduce warmup/drift bias.
  if (i % 2) { const afterMs = run(paintAuthContours); samples.push({ beforeMs: run(baselinePaint), afterMs }); }
  else { const beforeMs = run(baselinePaint); samples.push({ beforeMs, afterMs: run(paintAuthContours) }); }
}
console.log(JSON.stringify({ workload: "600 contour frames, 1440x900; math + no-op drawing sink (not Canvas/GPU)", node: process.version, samples, sink }, null, 2));
