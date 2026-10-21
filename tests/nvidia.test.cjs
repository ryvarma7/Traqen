const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadNvidia() {
  const filename = path.resolve(root, "lib/nvidia.ts");
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
  mod._compile(code, filename);
  return mod.exports;
}

const { NvidiaRequestError, generateNvidiaText, buildNvidiaRequestBody } =
  loadNvidia();

function configureEnvironment() {
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
  delete process.env.NVIDIA_BASE_URL;
}

test("NVIDIA NIM text client rejects a length-truncated answer instead of returning partial JSON", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;
  let calls = 0;

  global.fetch = async (url, init) => {
    calls += 1;
    assert.equal(
      url,
      "https://integrate.api.nvidia.com/v1/chat/completions"
    );
    assert.equal(init.headers.Authorization, "Bearer test-key");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "nvidia/nemotron-3-ultra-550b-a55b");
    assert.equal(body.max_tokens, 16384);
    assert.equal(body.temperature, 1.0);
    assert.equal(body.top_p, 0.95);
    // The reasoning trace is on: Nemotron 3 reasons before it answers and
    // returns the trace in its own field.
    assert.deepEqual(body.chat_template_kwargs, {
      enable_thinking: true,
    });
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(body.messages.length, 2);
    assert.equal(body.messages[0].role, "system");
    assert.equal(body.messages[0].content, "contract");
    assert.equal(body.messages[1].role, "user");
    assert.equal(body.messages[1].content, "planner prompt");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"track_title":"cut off',
              reasoning: "planning the curriculum",
            },
            finish_reason: "length",
          },
        ],
      }),
    };
  };

  try {
    await assert.rejects(
      generateNvidiaText("planner prompt", {
        system: "contract",
        timeoutMs: 1000,
      }),
      (error) =>
        error instanceof NvidiaRequestError && error.code === "incomplete"
    );
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("NVIDIA NIM text client classifies an empty length-truncated choice as incomplete", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ finish_reason: "length", message: { content: "" } }],
    }),
  });

  try {
    await assert.rejects(
      generateNvidiaText("planner prompt", { timeoutMs: 1000 }),
      (error) =>
        error instanceof NvidiaRequestError && error.code === "incomplete"
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("NVIDIA NIM text client returns the assistant content when generation finishes normally", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: '{"ok":true}',
            reasoning: "thought it through",
          },
          finish_reason: "stop",
        },
      ],
      usage: { completion_tokens: 512 },
    }),
  });

  try {
    assert.equal(
      await generateNvidiaText("planner prompt", { timeoutMs: 1000 }),
      '{"ok":true}'
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("NVIDIA NIM text client accepts the OpenAI-style reasoning field", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: '{"ok":true}',
            reasoning_content: "thought it through",
          },
          finish_reason: "stop",
        },
      ],
    }),
  });

  try {
    assert.equal(
      await generateNvidiaText("planner prompt", { timeoutMs: 1000 }),
      '{"ok":true}'
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("NVIDIA NIM text client treats the NIM stop reasons as success", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;

  for (const finishReason of ["stop", "eos_token", "stop_sequence"]) {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: finishReason },
        ],
      }),
    });

    assert.equal(
      await generateNvidiaText("planner prompt", { timeoutMs: 1000 }),
      '{"ok":true}'
    );
  }

  global.fetch = originalFetch;
});

test("NVIDIA NIM text client can turn the reasoning trace on when asked", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;

  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.chat_template_kwargs, {
      enable_thinking: true,
    });
    assert.equal(body.messages.length, 1);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: "stop" },
        ],
      }),
    };
  };

  try {
    assert.equal(
      await generateNvidiaText("planner prompt", {
        thinking: true,
        timeoutMs: 1000,
      }),
      '{"ok":true}'
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("NVIDIA NIM text client asks for a lower reasoning effort on request", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;

  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.chat_template_kwargs, {
      enable_thinking: true,
      medium_effort: true,
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: "stop" },
        ],
      }),
    };
  };

  try {
    assert.equal(
      await generateNvidiaText("planner prompt", {
        thinking: true,
        effort: "medium",
        timeoutMs: 1000,
      }),
      '{"ok":true}'
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("NVIDIA NIM text client reads the reasoning effort from the environment", async () => {
  configureEnvironment();
  process.env.NVIDIA_THINKING_EFFORT = "low";
  const originalFetch = global.fetch;

  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.chat_template_kwargs, {
      enable_thinking: true,
      low_effort: true,
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: "stop" },
        ],
      }),
    };
  };

  try {
    assert.equal(
      await generateNvidiaText("planner prompt", { timeoutMs: 1000 }),
      '{"ok":true}'
    );
  } finally {
    global.fetch = originalFetch;
    delete process.env.NVIDIA_THINKING_EFFORT;
  }
});

test("NVIDIA NIM text client turns the reasoning trace off from the environment", async () => {
  configureEnvironment();
  process.env.NVIDIA_THINKING = "off";
  const originalFetch = global.fetch;

  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: "stop" },
        ],
      }),
    };
  };

  try {
    assert.equal(
      await generateNvidiaText("planner prompt", { timeoutMs: 1000 }),
      '{"ok":true}'
    );
  } finally {
    global.fetch = originalFetch;
    delete process.env.NVIDIA_THINKING;
  }
});

test("NVIDIA NIM text client retries without the chat template extras when they are rejected", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;
  let calls = 0;

  global.fetch = async (_url, init) => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            detail: "chat_template_kwargs: force_nonempty_content is not supported",
          }),
        json: async () => ({}),
      };
    }
    const body = JSON.parse(init.body);
    assert.deepEqual(body.chat_template_kwargs, { enable_thinking: true });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: "stop" },
        ],
      }),
    };
  };

  try {
    assert.equal(
      await generateNvidiaText("planner prompt", {
        thinking: true,
        timeoutMs: 5000,
      }),
      '{"ok":true}'
    );
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("NVIDIA NIM text client retries without JSON decoding when the deployment rejects it", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;
  let calls = 0;

  global.fetch = async (_url, init) => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            detail: "response_format json_object is not supported with guided decoding",
          }),
        json: async () => ({}),
      };
    }
    const body = JSON.parse(init.body);
    assert.equal(body.response_format, undefined);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: "stop" },
        ],
      }),
    };
  };

  try {
    assert.equal(
      await generateNvidiaText("planner prompt", {
        thinking: true,
        timeoutMs: 5000,
      }),
      '{"ok":true}'
    );
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("NVIDIA NIM text client honours a custom base url", async () => {
  configureEnvironment();
  process.env.NVIDIA_BASE_URL = "http://localhost:8000/v1/";
  const originalFetch = global.fetch;

  global.fetch = async (url) => {
    assert.equal(url, "http://localhost:8000/v1/chat/completions");
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: "stop" },
        ],
      }),
    };
  };

  try {
    assert.equal(
      await generateNvidiaText("planner prompt", { timeoutMs: 1000 }),
      '{"ok":true}'
    );
  } finally {
    global.fetch = originalFetch;
    configureEnvironment();
  }
});

test("NVIDIA NIM text client treats a rejected key as a configuration error without retrying", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;
  let calls = 0;

  global.fetch = async () => {
    calls += 1;
    return { ok: false, status: 401, json: async () => ({}) };
  };

  try {
    await assert.rejects(
      generateNvidiaText("planner prompt", { timeoutMs: 1000 }),
      (error) =>
        error instanceof NvidiaRequestError && error.code === "configuration"
    );
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("NVIDIA NIM text client retries server errors and succeeds on a later attempt", async () => {
  configureEnvironment();
  const originalFetch = global.fetch;
  let calls = 0;

  global.fetch = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 503, json: async () => ({}) };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: '{"ok":true}' }, finish_reason: "stop" },
        ],
      }),
    };
  };

  try {
    assert.equal(
      await generateNvidiaText("planner prompt", { timeoutMs: 5000 }),
      '{"ok":true}'
    );
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("NVIDIA NIM text client requires an API key and a model id", async () => {
  const originalKey = process.env.NVIDIA_API_KEY;
  const originalModel = process.env.NVIDIA_MODEL;
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: false, status: 500, json: async () => ({}) };
  };

  try {
    delete process.env.NVIDIA_API_KEY;
    await assert.rejects(
      generateNvidiaText("planner prompt", { timeoutMs: 1000 }),
      (error) =>
        error instanceof NvidiaRequestError && error.code === "configuration"
    );

    process.env.NVIDIA_API_KEY = "test-key";
    delete process.env.NVIDIA_MODEL;
    await assert.rejects(
      generateNvidiaText("planner prompt", { timeoutMs: 1000 }),
      (error) =>
        error instanceof NvidiaRequestError && error.code === "configuration"
    );
    assert.equal(calls, 0);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.NVIDIA_MODEL;
    else process.env.NVIDIA_MODEL = originalModel;
  }
});

test("the request body carries the Nemotron chat template flag", () => {
  const body = buildNvidiaRequestBody(
    "nvidia/nemotron-3-ultra-550b-a55b",
    [{ role: "user", content: "hi" }],
    { thinking: true }
  );
  assert.deepEqual(body.chat_template_kwargs, {
    enable_thinking: true,
  });
  assert.equal(body.stream, false);
  assert.equal(body.max_tokens, 16384);
  assert.equal(body.temperature, 1.0);
  assert.equal(body.top_p, 0.95);
  assert.deepEqual(body.response_format, { type: "json_object" });
});

test("the request body leaves the reasoning trace off when it is switched off", () => {
  const body = buildNvidiaRequestBody(
    "nvidia/nemotron-3-ultra-550b-a55b",
    [{ role: "user", content: "hi" }],
    { thinking: false }
  );
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false });
});
