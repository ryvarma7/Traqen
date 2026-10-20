// Optional, isolated Chromium regression/measurement runner. No new dependency.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn, execFileSync } = require("node:child_process");
const { once } = require("node:events");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const postcss = require("postcss");
const tailwind = require("tailwindcss");
const loadConfig = require("tailwindcss/loadConfig");
const root = path.resolve(__dirname, "../..");
const baselineArg = process.argv.indexOf("--baseline");
const baseline = baselineArg < 0 ? undefined : process.argv[baselineArg + 1];
const checksOnly = process.argv.includes("--checks-only");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function bundle(output) {
  const stubs = path.join(__dirname, "stubs.jsx");
  const alias = { "next/link$": stubs, "next/navigation$": stubs,
    "sonner$": stubs, "@/lib/create-bus$": stubs, "@/lib/notes-privacy$": stubs };
  for (const name of ["applications", "tasks", "notes", "tracks"]) alias[`@/lib/actions/${name}$`] = stubs;
  alias["@"] = root;
  const compiler = webpack({
    mode: "production", devtool: false, context: root,
    entry: path.join(__dirname, "fixture.jsx"),
    output: { path: output, filename: "app.js", publicPath: "/" },
    optimization: { minimize: false },
    resolve: { extensions: [".tsx", ".ts", ".jsx", ".js"], alias },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/,
      use: { loader: path.join(__dirname, "compile-loader.cjs"), options: { root, baseline } } }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(() => {});
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
  const css = baseline
    ? execFileSync("git", ["show", `${baseline}:app/globals.css`], { cwd: root }).toString()
    : fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
  const config = loadConfig(path.join(root, "tailwind.config.ts"));
  const result = await postcss([tailwind(config)]).process(css, { from: path.join(root, "app/globals.css") });
  fs.writeFileSync(path.join(output, "app.css"), result.css);
}

async function connect(url) {
  const socket = new WebSocket(url);
  await once(socket, "open");
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    clearTimeout(handler.timer);
    if (message.error) handler.reject(new Error(JSON.stringify(message.error)));
    else handler.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const handler of pending.values()) { clearTimeout(handler.timer); handler.reject(new Error("Browser closed")); }
    pending.clear();
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const current = ++id;
    const timer = setTimeout(() => { pending.delete(current); reject(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(current, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: current, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send("Runtime.enable");
  await send("Page.enable");
  return { send, evaluate, errors, close: () => socket.close() };
}

async function main() {
  const base = process.env.PERF_TEMP_DIR || os.tmpdir();
  const output = fs.mkdtempSync(path.join(base, "traqen-perf-"));
  let browser, server, cdp;
  try {
    await bundle(output);
    server = http.createServer((req, res) => {
      const name = path.basename(new URL(req.url, "http://localhost").pathname);
      if (!name) { res.end('<!doctype html><html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>'); return; }
      if (!/^[\w.-]+\.(js|css)$/.test(name) || !fs.existsSync(path.join(output, name))) { res.writeHead(404).end(); return; }
      res.setHeader("Content-Type", name.endsWith("css") ? "text/css" : "text/javascript");
      fs.createReadStream(path.join(output, name)).pipe(res);
    }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const candidates = [process.env.CHROME_PATH,
      process.platform === "win32" && path.join(process.env.PROGRAMFILES || "", "Google/Chrome/Application/chrome.exe"),
      process.platform === "linux" && "/usr/bin/chromium",
      process.platform === "darwin" && "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
    const executable = candidates.find((name) => fs.existsSync(name));
    assert.ok(executable, "Set CHROME_PATH to a local Chrome/Chromium executable");
    browser = spawn(executable, ["--headless=new", "--no-first-run", "--no-default-browser-check",
      "--remote-debugging-port=0", `--user-data-dir=${path.join(output, "profile")}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Chromium startup timeout")), 15000);
      browser.once("error", reject);
      browser.stderr.on("data", (chunk) => { const match = chunk.toString().match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    });
    const targets = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
    cdp = await connect(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const navigate = async (section, width = 1440, reduced = false) => {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] });
      await cdp.send("Page.navigate", { url: `${origin}/?section=${section}` });
      for (let i = 0; i < 150; i++) { if (await cdp.evaluate("!!window.fixtureReady")) break; await pause(50); }
      assert.equal(await cdp.evaluate("!!window.fixtureReady"), true, `Fixture ready: ${section}`);
      await pause(700);
    };
    const result = { baseline: baseline || "working tree", node: process.version, platform: process.platform, samples: [] };
    // Measurements and behavior assertions are appended below.
    for (const width of checksOnly ? [] : [1440, 375]) {
      for (const section of ["applications", "tasks", "notes", "calendar", "tracks", "track-detail", "hub"]) {
        await navigate(section, width);
        const metrics = await cdp.evaluate(`({ section: ${JSON.stringify(section)}, width: ${width},
          nodes: document.querySelectorAll('*').length,
          editors: document.querySelectorAll('button[aria-label="Edit task"],button[aria-label="Edit"]').length,
          agendas: [...document.querySelectorAll('a')].filter(a => a.textContent.includes('Synthetic event')).length,
          steps: document.querySelectorAll('button[role="checkbox"]').length,
          lastNoteOpacity: getComputedStyle([...document.querySelectorAll('[role="button"][tabindex]')].at(-1) || document.body).opacity,
          overflow: document.documentElement.scrollWidth > innerWidth })`);
        if (!baseline) {
          if (["tasks", "applications"].includes(section)) assert.equal(metrics.editors, section === "tasks" || width >= 768 ? 120 : 0);
          if (section === "calendar") assert.equal(metrics.agendas, 1);
          if (section === "track-detail") assert.equal(metrics.steps, 20);
          if (section === "notes") assert.equal(Number(metrics.lastNoteOpacity), 1);
          assert.equal(metrics.overflow, false, `${section} horizontal overflow at ${width}`);
        }
        result.samples.push(metrics);
      }
    }
    result.interactions = [];
    for (let run = 0; run < (checksOnly ? 0 : 3); run++) {
      await navigate("notes");
      await cdp.evaluate("document.querySelector('[role=button][tabindex]').click()");
      await pause(350);
      await cdp.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Edit').click()");
      await pause(100);
      await cdp.evaluate("window.__noteTileRenders = 0; const editor = document.querySelector('textarea'); editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length)");
      for (let i = 0; i < 20; i++) {
        await cdp.send("Input.insertText", { text: "x" });
        await cdp.evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
      }
      const tileRenders = await cdp.evaluate("window.__noteTileRenders");
      const draft = await cdp.evaluate("({ value: document.querySelector('textarea').value, active: document.activeElement.tagName })");
      assert.ok(draft.value.endsWith("x".repeat(20)), `Keystrokes must reach the editor: ${JSON.stringify(draft)}`);
      if (!baseline) assert.equal(tileRenders, 0, "Typing must not rerender the note collection");
      await navigate("calendar");
      await cdp.evaluate("window.__dayRenders = 0; [...document.querySelectorAll('button[aria-pressed]')].find(b => b.getAttribute('aria-pressed') === 'false').click()");
      await pause(600);
      const dayRenders = await cdp.evaluate("window.__dayRenders");
      if (!baseline) assert.equal(dayRenders, 2, "Only old/new selected days should rerender");
      result.interactions.push({ run: run + 1, noteTileRendersFor20Keystrokes: tileRenders, calendarDayRendersForSelection: dayRenders });
    }
    result.frames = [];
    for (const section of checksOnly ? [] : ["notes", "tasks", "applications", "tracks", "track-detail", "auth", "hub"]) {
      await navigate(section);
      for (let run = 0; run < 3; run++) {
        const frames = await cdp.evaluate(`new Promise(resolve => {
          const gaps = []; let previous; let start;
          const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
          function tick(t) {
            if (start === undefined) start = t;
            if (previous !== undefined) gaps.push(t - previous);
            previous = t;
            window.scrollTo(0, maximum * ((Math.sin((t - start) / 250) + 1) / 2));
            if (t - start < 1200) requestAnimationFrame(tick);
            else { const sorted = [...gaps].sort((a,b) => a-b); resolve({
              frames: gaps.length, medianMs: sorted[Math.floor(sorted.length/2)],
              p95Ms: sorted[Math.floor(sorted.length*.95)], maxMs: Math.max(...gaps),
              over20ms: gaps.filter(ms => ms > 20).length }); }
          } requestAnimationFrame(tick);
        })`);
        result.frames.push({ section, run: run + 1, ...frames });
      }
    }
    // Dynamic reduced-motion changes and mobile accordion behavior.
    if (!baseline) {
      await navigate("tasks", 375, true);
      await cdp.evaluate("[...document.querySelectorAll('button[aria-expanded]')].find(b => b.textContent.includes('In progress')).click()");
      await pause(100);
      assert.equal(await cdp.evaluate("[...document.querySelectorAll('button[aria-expanded]')].find(b => b.textContent.includes('In progress')).getAttribute('aria-expanded')"), "true");
      await navigate("notes", 375, true);
      assert.equal(await cdp.evaluate("getComputedStyle(document.querySelector('[role=button][tabindex]')).filter"), "none");
      assert.equal(await cdp.evaluate("[...document.querySelectorAll('[role=button][tabindex]')].find(e=>e.textContent.includes('Synthetic note 1') && e.textContent.includes('Content hidden')).textContent.includes('Synthetic preview 1')"), false);
      await cdp.evaluate("document.querySelectorAll('[role=button][tabindex]')[1].querySelector('button').click()");
      await pause(100);
      assert.equal(await cdp.evaluate("document.querySelectorAll('[role=button][tabindex]')[1].textContent.includes('Synthetic preview 1')"), true, "Privacy toggle shows the preview");
      await cdp.evaluate("window.__privacyFail = true; document.querySelectorAll('[role=button][tabindex]')[1].querySelector('button').click()");
      await pause(100);
      assert.equal(await cdp.evaluate("document.querySelectorAll('[role=button][tabindex]')[1].textContent.includes('Synthetic preview 1')"), true, "Failed privacy writes roll back");
      for (const section of ["tasks", "applications"]) {
        await navigate(section);
        await cdp.evaluate(`document.querySelector('button[aria-label="${section === "tasks" ? "Edit task" : "Edit"}"]').click()`);
        for (let i = 0; i < 50; i++) { if (await cdp.evaluate("!!document.querySelector('form')")) break; await pause(50); }
        assert.equal(await cdp.evaluate("!!document.querySelector('form')"), true, `Lazy ${section} form loads`);
        await cdp.evaluate("document.addEventListener('keydown', e => window.__lastKey = e.key, {once:true})");
        await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await pause(600);
        const closed = await cdp.evaluate("({ form:!!document.querySelector('form'), key:window.__lastKey, layer:[...document.querySelectorAll('.fixed')].map(e=>e.getAttribute('style')) })");
        assert.equal(closed.form, false, `Escape dismisses ${section} form: ${JSON.stringify(closed)}`);
      }
      await navigate("shell");
      await cdp.evaluate("document.querySelector('button').click()");
      await pause(500);
      const veil = await cdp.evaluate("(() => { const e = document.querySelector('.fixed'); const r = e.getBoundingClientRect(); return {height:r.height, width:r.width, filter:getComputedStyle(e).backdropFilter}; })()");
      assert.ok(veil.height > 0 && veil.height <= 900, "Navigation blur is bounded to the visible viewport");
      assert.ok(veil.width > 0 && veil.width <= 1440);
      await navigate("auth", 375, true);
      await cdp.evaluate("window.__strokes=0; const p = CanvasRenderingContext2D.prototype; const stroke=p.stroke; p.stroke=function(...args){window.__strokes++; return stroke.apply(this,args)}");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
      await pause(200);
      assert.equal(await cdp.evaluate("window.__strokes"), 9, "Reduced-motion resize repaints one static contour frame");
      await pause(150);
      assert.equal(await cdp.evaluate("window.__strokes"), 9, "Reduced motion does not run a continuous canvas loop");
    }
    console.log(JSON.stringify(result, null, 2));
    assert.deepEqual(cdp.errors, [], "No uncaught browser exceptions");
  } finally {
    if (cdp) await cdp.send("Browser.close").catch(() => {});
    cdp?.close();
    if (browser && browser.exitCode === null) {
      const exit = once(browser, "exit");
      await Promise.race([exit, pause(3000)]);
      if (browser.exitCode === null) browser.kill();
      await Promise.race([exit, pause(3000)]);
    }
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(output, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
