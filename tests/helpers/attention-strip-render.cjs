const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const React = require("react");
const jsxRuntime = require("react/jsx-runtime");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
const componentPath = path.join(root, "components/hub/attention-strip.tsx");
let activeRender;

// Only the component's state hooks are replayed. ReactDOMServer still renders
// the real component, Next Link, motion elements, icons, and shared pills.
// This permits checking mobile callbacks without a DOM dependency. It does not
// simulate React scheduling, effects, hydration, or browser event dispatch.
const testReact = {
  ...React,
  useState(initialValue) {
    const [initialState] = React.useState(initialValue);
    assert.ok(activeRender, "State hooks must run inside the test renderer");
    const session = activeRender;
    const slot = session.cursor++;
    if (!(slot in session.state)) session.state[slot] = initialState;
    return [session.state[slot], (update) => {
      session.state[slot] = typeof update === "function"
        ? update(session.state[slot])
        : update;
    }];
  },
};

const testJsx = { ...jsxRuntime };
for (const factory of ["jsx", "jsxs"]) {
  testJsx[factory] = (type, props, key) => {
    if (type === "button" && activeRender) activeRender.buttons.push(props);
    return jsxRuntime[factory](type, props, key);
  };
}

function loadComponent() {
  const previous = new Map([".ts", ".tsx"].map((ext) => [ext, Module._extensions[ext]]));
  const compile = (mod, filename) => {
    const originalRequire = mod.require.bind(mod);
    mod.require = (specifier) => {
      if (filename === componentPath && specifier === "react") return testReact;
      if (filename === componentPath && specifier === "react/jsx-runtime") return testJsx;
      return originalRequire(specifier.startsWith("@/")
        ? path.join(root, specifier.slice(2))
        : specifier);
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
    for (const ext of previous.keys()) Module._extensions[ext] = compile;
    return require(componentPath).AttentionStrip;
  } finally {
    for (const [ext, handler] of previous) {
      if (handler) Module._extensions[ext] = handler;
      else delete Module._extensions[ext];
    }
  }
}

const AttentionStrip = loadComponent();

function decode(value) {
  const entities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number(entity.slice(1)));
    return entities[entity.toLowerCase()];
  });
}

// A small tokenizer for React's well-formed static markup, not application
// source. No assertions depend on the component's source text or layout classes.
function parseMarkup(html) {
  const document = { tag: "#document", attrs: {}, children: [], parent: null };
  const stack = [document];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  for (const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) ?? []) {
    if (token.startsWith("<!--")) continue;
    if (token.startsWith("</")) {
      assert.equal(stack.pop().tag, token.slice(2, -1).trim());
    } else if (token.startsWith("<")) {
      const [, tag, rest] = token.match(/^<([^\s/>]+)([\s\S]*)>$/);
      const attrs = {};
      for (const [, key, value = ""] of rest.matchAll(/([^\s=/>]+)(?:="([^"]*)")?/g)) {
        attrs[key] = decode(value);
      }
      const parent = stack[stack.length - 1];
      const node = { tag, attrs, children: [], parent };
      parent.children.push(node);
      if (!voidTags.has(tag) && !token.endsWith("/>")) stack.push(node);
    } else {
      stack[stack.length - 1].children.push(decode(token));
    }
  }
  assert.equal(stack.length, 1, "Static markup must have balanced tags");
  return document;
}

function text(node) {
  return (typeof node === "string" ? node : node.children.map(text).join(" "))
    .replace(/\s+/g, " ").trim();
}

function findAll(node, predicate) {
  if (typeof node === "string") return [];
  return [
    ...(predicate(node) ? [node] : []),
    ...node.children.flatMap((child) => findAll(child, predicate)),
  ];
}

// Only display utilities at the mobile/md boundary are interpreted. These are
// visibility checks, not a CSS engine or a claim about geometry/appearance.
function visible(node, viewport) {
  for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
    if ("hidden" in ancestor.attrs) return false;
    const classes = (ancestor.attrs.class ?? "").split(/\s+/);
    let hidden = classes.includes("hidden");
    if (viewport === "desktop") {
      const displays = classes.filter((name) => /^md:(hidden|block|inline|inline-block|inline-flex|flex|grid|list-item)$/.test(name));
      if (displays.length) hidden = displays[displays.length - 1] === "md:hidden";
    }
    if (hidden) return false;
  }
  return true;
}

function accessibleName(node) {
  return node.attrs["aria-label"] ?? text(node);
}

function renderAttention(items) {
  const session = { state: [], cursor: 0, buttons: [] };
  const render = () => {
    session.cursor = 0;
    session.buttons = [];
    const previous = activeRender;
    activeRender = session;
    let html;
    try {
      html = renderToStaticMarkup(React.createElement(AttentionStrip, { items }));
    } finally {
      activeRender = previous;
    }
    const document = parseMarkup(html);
    return {
      document,
      html,
      click(button) {
        assert.equal(button.tag, "button");
        assert.ok(!("disabled" in button.attrs), "Cannot click a disabled button");
        const props = session.buttons.find((candidate) =>
          candidate["aria-controls"] === button.attrs["aria-controls"] &&
          candidate["aria-label"] === button.attrs["aria-label"]
        );
        assert.equal(typeof props?.onClick, "function", `${accessibleName(button)} must have an onClick handler`);
        props.onClick();
        return render();
      },
    };
  };
  return render();
}

module.exports = { renderAttention, findAll, text, visible, accessibleName };
