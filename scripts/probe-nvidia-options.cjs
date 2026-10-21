/**
 * Probes which NVIDIA NIM options the hosted endpoint actually accepts.
 * Prints a status/response matrix for the options the model documents.
 */
const fs = require("node:fs");

for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = process.env.NVIDIA_MODEL;

async function probe(label, extra, prompt = "Reply with only the JSON object {\"ok\": true}.") {
  const started = Date.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 1,
      top_p: 0.95,
      stream: false,
      ...extra,
    }),
  });

  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  const message = body.choices?.[0]?.message ?? {};
  const reasoning = message.reasoning_content ?? message.reasoning ?? "";
  const content = String(message.content ?? "");
  console.log(
    `${label.padEnd(46)} status=${res.status} reasoning=${String(reasoning).length}ch content=${content.length}ch ${(Date.now() - started)}ms` +
      (res.ok ? "" : ` err=${JSON.stringify(body).slice(0, 120)}`)
  );
  return { res, body };
}

(async () => {
  console.log(`model: ${MODEL}\n`);

  await probe("chat_template_kwargs: {enable_thinking:false}", {
    chat_template_kwargs: { enable_thinking: false },
  });
  await probe("chat_template_kwargs: {enable_thinking:true}", {
    chat_template_kwargs: { enable_thinking: true },
  });
  await probe("enable_thinking + force_nonempty_content", {
    chat_template_kwargs: { enable_thinking: true, force_nonempty_content: true },
  });
  await probe("enable_thinking + medium_effort", {
    chat_template_kwargs: { enable_thinking: true, medium_effort: true },
  });
  await probe("enable_thinking + low_effort", {
    chat_template_kwargs: { enable_thinking: true, low_effort: true },
  });
  await probe("thinking_token_budget: 256", {
    chat_template_kwargs: { enable_thinking: true },
    thinking_token_budget: 256,
  });
  await probe("response_format: json_object", {
    response_format: { type: "json_object" },
  });
  await probe("response_format: json_schema", {
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "answer",
        schema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
      },
    },
  });
  await probe("tools + tool_choice", {
    tools: [
      {
        type: "function",
        function: {
          name: "noop",
          description: "does nothing",
          parameters: { type: "object", properties: {} },
        },
      },
    ],
    tool_choice: "auto",
  });
  await probe("request_id + seed + stop + n", {
    request_id: "traqen-probe-0001",
    seed: 7,
    stop: ["\n\n"],
    n: 1,
  });
  await probe("repetition_penalty + frequency_penalty", {
    repetition_penalty: 1.05,
    frequency_penalty: 0.1,
  });
})();
