const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..", "..");

/**
 * Loads a TypeScript module straight from the repo, in memory.
 *
 * The repo is TypeScript with a "@/lib/*" path alias and no build step for
 * the test suite, so each module is transpiled with the installed TypeScript
 * and its local imports are resolved back to source. No bundler, no network,
 * no generated files.
 *
 * The loader is per-call rather than global so each test file gets its own
 * module cache and cannot leak state into another file.
 */
function createLoader() {
  const cache = new Map();

  function loadTs(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;

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
    cache.set(filename, mod);

    const originalRequire = mod.require.bind(mod);
    mod.require = (request) => {
      // "@/lib/dates" -> "<repo>/lib/dates.ts". Only the repo's own path
      // alias is rewritten; anything else (zod, node builtins) resolves
      // normally.
      if (request.startsWith("@/lib/")) {
        return loadTs(`lib/${request.slice("@/lib/".length)}.ts`);
      }
      return originalRequire(request);
    };
    mod._compile(code, filename);
    return mod.exports;
  }

  return loadTs;
}

module.exports = { createLoader, root };
