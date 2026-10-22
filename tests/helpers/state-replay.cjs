const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const React = require("react");
const jsxRuntime = require("react/jsx-runtime");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");

/**
 * Loads a component module with a React whose `useState` is replayed between
 * renders, so an interaction can be replayed and the component rendered
 * again to see what the learner would then be looking at.
 *
 * The component, its children, icons and shared pills are the real ones —
 * only the state hooks are held still between renders. This is not a DOM:
 * effects, hydration, focus and browser events are out of scope, exactly as
 * in the attention-strip suite.
 */
function loadWithState(relativePath) {
  const componentPath = path.join(root, relativePath);
  let session = null;

  const testReact = {
    ...React,
    useState(initialValue) {
      const [initial] = React.useState(initialValue);
      assert.ok(session, "State hooks must run inside the test renderer");
      const current = session;
      const slot = current.cursor++;
      if (!(slot in current.state)) current.state[slot] = initial;
      return [
        current.state[slot],
        (update) => {
          current.state[slot] =
            typeof update === "function" ? update(current.state[slot]) : update;
        },
      ];
    },
  };

  const testJsx = { ...jsxRuntime };
  for (const factory of ["jsx", "jsxs"]) {
    testJsx[factory] = (type, props, key) => {
      if (type === "button" && session) session.buttons.push(props);
      return jsxRuntime[factory](type, props, key);
    };
  }

  const previous = new Map(
    [".ts", ".tsx"].map((ext) => [ext, Module._extensions[ext]])
  );
  const compile = (mod, filename) => {
    const originalRequire = mod.require.bind(mod);
    mod.require = (specifier) => {
      if (filename === componentPath && specifier === "react") return testReact;
      if (filename === componentPath && specifier === "react/jsx-runtime") {
        return testJsx;
      }
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

  let exported;
  try {
    for (const ext of previous.keys()) Module._extensions[ext] = compile;
    exported = require(componentPath);
  } finally {
    for (const [ext, handler] of previous) {
      if (handler) Module._extensions[ext] = handler;
      else delete Module._extensions[ext];
    }
  }

  /**
   * Renders a component. `buttons` holds the props of every button the
   * module itself rendered, so a test can pick one and replay its onClick.
   */
  function render(Component, props) {
    const state = { state: [], cursor: 0, buttons: [] };
    const run = () => {
      state.cursor = 0;
      state.buttons = [];
      const previousSession = session;
      session = state;
      try {
        return renderToStaticMarkup(React.createElement(Component, props));
      } finally {
        session = previousSession;
      }
    };

    let html = run();

    return {
      get html() {
        return html;
      },
      get buttons() {
        return state.buttons;
      },
      click(predicate) {
        const button = state.buttons.find(predicate);
        assert.ok(button, "the component rendered no matching button");
        assert.equal(
          typeof button.onClick,
          "function",
          "the matching button has no onClick"
        );
        button.onClick();
        html = run();
        return this;
      },
    };
  }

  return { exports: exported, render };
}

/** The text a rendered element carries, read from its props. */
function propsText(props) {
  const walk = (node) => {
    if (node === null || node === undefined || node === false) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(walk).join("");
    if (node.props) return walk(node.props.children);
    return "";
  };
  return walk(props.children);
}

module.exports = { loadWithState, propsText };
