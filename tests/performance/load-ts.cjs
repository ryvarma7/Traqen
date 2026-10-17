/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

module.exports = function loadTs(relative, globals = {}, native = false) {
  const file = path.resolve(__dirname, "../..", relative);
  const source = fs.readFileSync(file, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
  }, fileName: file }).outputText;
  const module = { exports: {} };
  if (native) new Function("exports", code)(module.exports);
  else vm.runInNewContext(code, { module, exports: module.exports, ...globals }, { filename: relative });
  return module.exports;
};
