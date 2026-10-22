const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

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

const { Select } = loadModule("components/ui/select.tsx");

/** Every source file that could hold a dropdown. */
function sourceFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      found.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

test("no screen uses a native select", () => {
  // The OS draws the native select's popup, so it can never carry the app
  // theme — every dropdown has to be the themed listbox instead. JSX native
  // elements are lowercase, so <Select> (the themed one) does not match.
  const offenders = [];
  for (const dir of ["components", "app"]) {
    for (const file of sourceFiles(path.join(root, dir))) {
      // The themed component itself documents the element it replaces.
      if (file.endsWith(path.join("components", "ui", "select.tsx"))) continue;
      const source = fs.readFileSync(file, "utf8");
      if (/<select[\s>]/.test(source)) {
        offenders.push(path.relative(root, file));
      }
    }
  }
  assert.deepEqual(offenders, [], "native <select> elements bypass the theme");
});

test("the themed select renders a listbox trigger, not a select element", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Select,
      { value: "core" },
      React.createElement("option", { value: "core" }, "Core React patterns"),
      React.createElement("option", { value: "state" }, "State and effects")
    )
  );
  assert.doesNotMatch(html, /<select/i);
  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, /Core React patterns/);
  assert.match(html, /aria-expanded="false"/);
});

test("the themed select keeps the value in a hidden input", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Select,
      { name: "phase", value: "state" },
      React.createElement("option", { value: "core" }, "Core React patterns"),
      React.createElement("option", { value: "state" }, "State and effects")
    )
  );
  assert.match(html, /type="hidden"/);
  assert.match(html, /name="phase"/);
  assert.match(html, /value="state"/);
});

test("the themed select is disabled when asked", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      Select,
      { disabled: true },
      React.createElement("option", { value: "core" }, "Core React patterns")
    )
  );
  assert.match(html, /disabled/);
});
