/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const ts = require("typescript");

// Test-only bundler: no app endpoint, auth bypass, or live database is involved.
module.exports = function compile(source) {
  const { baseline, root } = this.getOptions();
  const relative = path.relative(root, this.resourcePath).replaceAll(path.sep, "/");
  if (baseline && /^(components|lib)\//.test(relative)) {
    try { source = execFileSync("git", ["show", `${baseline}:${relative}`], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString(); }
    catch { /* New shared helpers retain their current implementation. */ }
  }
  // Count real render work without shipping instrumentation in the application.
  if (/components\/notes\/(notes-view|note-grid)\.tsx$/.test(relative)) {
    source = source.replaceAll("{relativeTime(note.updated_at)}", "{(window.__noteTileRenders = (window.__noteTileRenders || 0) + 1, relativeTime(note.updated_at))}");
  }
  if (relative === "components/calendar/calendar-view.tsx") {
    source = source.replaceAll("aria-pressed={isSelected}", "aria-pressed={(window.__dayRenders = (window.__dayRenders || 0) + 1, isSelected)}");
  }
  return ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, fileName: this.resourcePath }).outputText;
};
