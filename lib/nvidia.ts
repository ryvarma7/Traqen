/**
 * Server-side NVIDIA NIM (Nemotron) REST client.
 *
 * This module is only imported by server actions. Keep the API key and model
 * configuration here so they can never be part of a client bundle or an
 * action response.
 *
 * NVIDIA NIM exposes an OpenAI-compatible chat-completions endpoint:
 *   POST https://integrate.api.nvidia.com/v1/chat/completions
 *   Authorization: Bearer <api key>
 *
 * Nemotron 3 is a reasoning model and it thinks by default. The chat template
 * flag `chat_template_kwargs.enable_thinking` turns the reasoning trace on or
 * off per request. When it is on, the trace comes back in its own field
 * (`reasoning_content`) and the answer comes back clean in `content`.
 *
 * Do not send `force_nonempty_content`: it stops the model returning an
 * empty answer when the reasoning phase used up the token budget, but it
 * also makes the model fold the reasoning into the answer, which in JSON
 * mode shows up as a stray "thinking" key next to the plan.
 *
 * Reasoning tokens are billed against `max_tokens`, so the output budget has
 * to cover both the trace and the answer.
 */

export type NvidiaRequestErrorCode =
  | "configuration"
  | "timeout"
  | "incomplete"
  | "provider";

export class NvidiaRequestError extends Error {
  readonly code: NvidiaRequestErrorCode;
  readonly status?: number;

  constructor(code: NvidiaRequestErrorCode, status?: number) {
    super("NVIDIA NIM request failed");
    this.name = "NvidiaRequestError";
    this.code = code;
    this.status = status;
  }
}

export type NvidiaTextOptions = {
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
  /** System message. Holds the contract; the user message holds the data. */
  system?: string;
  /**
   * Reasoning trace. On by default.
   *
   * Nemotron 3 writes a reasoning trace before the answer and returns it in
   * its own field, so the answer stays clean. Set NVIDIA_THINKING=off to
   * trade the reasoning for a faster, smaller answer.
   */
  thinking?: boolean;
  /**
   * How hard the model thinks.
   *
   * "full" leaves the chat template on its maximum reasoning effort, "medium"
   * and "low" ask for fewer reasoning tokens. Only used when thinking is on.
   */
  effort?: NvidiaThinkingEffort;
  /** Output budget, shared between reasoning and the final answer. */
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  /** Ask the server to constrain the answer to JSON. */
  jsonMode?: boolean;
};

export type NvidiaThinkingEffort = "full" | "medium" | "low";

const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 1_000;
// The planner emits several nested objects and, with reasoning on, a reasoning
// trace first. Nemotron 3 Ultra tops out at 32,768 output tokens, so this
// leaves room for both the trace and the answer.
const MAX_OUTPUT_TOKENS = 16_384;
// NVIDIA's own guidance for the Nemotron 3 family is temperature 1.0 with
// top_p 0.95. The strict JSON contract is enforced by the prompt and by the
// server-side Zod schema, not by the sampler.
const TEMPERATURE = 1.0;
const TOP_P = 0.95;

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";

/** finish_reason values that mean the answer completed normally. */
const SUCCESS_FINISH_REASONS = new Set(["stop", "eos_token", "stop_sequence"]);

type NvidiaResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
      /** NIM reasoning field. */
      reasoning?: unknown;
      /** OpenAI-compatible reasoning field, used by some NIM deployments. */
      reasoning_content?: unknown;
    };
    finish_reason?: unknown;
  }>;
  usage?: {
    completion_tokens?: number;
    prompt_tokens?: number;
  };
  error?: unknown;
  detail?: unknown;
};

type NvidiaResponseContent = {
  text: string | null;
  finishReason: string | null;
  reasoningLength: number;
  completionTokens: number | null;
};

function responseContent(payload: unknown): NvidiaResponseContent {
  if (!payload || typeof payload !== "object") {
    return {
      text: null,
      finishReason: null,
      reasoningLength: 0,
      completionTokens: null,
    };
  }

  const body = payload as NvidiaResponse;
  const choices = body.choices;
  const completionTokens =
    typeof body.usage?.completion_tokens === "number"
      ? body.usage.completion_tokens
      : null;

  if (!Array.isArray(choices)) {
    return {
      text: null,
      finishReason: null,
      reasoningLength: 0,
      completionTokens,
    };
  }

  let lastFinishReason: string | null = null;
  let reasoningLength = 0;

  for (const choice of choices) {
    const finishReason =
      typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
    if (finishReason) lastFinishReason = finishReason;

    const reasoning = choice?.message?.reasoning ?? choice?.message?.reasoning_content;
    if (typeof reasoning === "string") reasoningLength += reasoning.length;

    const content = choice?.message?.content;
    const text = typeof content === "string" ? content.trim() : "";

    if (text) {
      return {
        text,
        finishReason,
        reasoningLength,
        completionTokens,
      };
    }
  }

  return {
    text: null,
    finishReason: lastFinishReason,
    reasoningLength,
    completionTokens,
  };
}

/**
 * Builds the chat-completions payload.
 *
 * Exported so the exact request that goes over the wire can be inspected and
 * asserted in tests without reaching into the request path.
 */
export function buildNvidiaRequestBody(
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  options: {
    thinking?: boolean;
    effort?: NvidiaThinkingEffort;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    jsonMode?: boolean;
    /** Set false to drop the optional chat-template flags. */
    templateExtras?: boolean;
  } = {}
): Record<string, unknown> {
  const thinking = options.thinking !== false;
  const effort = options.effort ?? "full";
  const extras = options.templateExtras !== false;

  // Nemotron reasoning controls. These are chat template flags, not OpenAI
  // parameters:
  //   enable_thinking        - the reasoning trace itself (on by default).
  //                             The trace comes back in its own field, so the
  //                             answer stays clean.
  //   medium_effort / low_effort - ask for fewer reasoning tokens
  //
  // force_nonempty_content is deliberately NOT sent. It stops the model
  // returning an empty answer when the reasoning phase used the whole token
  // budget, but it also makes the model fold the reasoning into the answer,
  // which in JSON mode shows up as a stray "thinking" key next to the plan.
  const chatTemplate: Record<string, unknown> = { enable_thinking: thinking };
  if (extras && thinking) {
    if (effort === "medium") chatTemplate.medium_effort = true;
    if (effort === "low") chatTemplate.low_effort = true;
  }

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    max_tokens: options.maxTokens ?? MAX_OUTPUT_TOKENS,
    temperature: options.temperature ?? TEMPERATURE,
    top_p: options.topP ?? TOP_P,
    stream: false,
    chat_template_kwargs: chatTemplate,
  };

  if (options.jsonMode !== false) {
    // Guided JSON decoding. The prompt already demands JSON only, so this is
    // belt and braces: if a deployment rejects it, the request is retried
    // without it rather than failing the whole generation.
    body.response_format = { type: "json_object" };
  }

  return body;
}

/** True when the error looks like a rejection of the JSON decoding request. */
function isJsonModeRejection(text: string): boolean {
  return /response_format|json_schema|guided decoding|guided_json|json_object/i.test(
    text
  );
}

/** True when the error looks like a rejection of the chat template flags. */
function isTemplateRejection(text: string): boolean {
  return /chat_template_kwargs|enable_thinking|force_nonempty_content|effort/i.test(
    text
  );
}

/**
 * Whether the deployment wants the reasoning trace on.
 *
 * On by default. NVIDIA_THINKING=off trades the reasoning for a faster,
 * smaller answer.
 */
function configuredThinking(): boolean {
  const value = process.env.NVIDIA_THINKING?.trim().toLowerCase();
  if (value === "off" || value === "false" || value === "0") return false;
  return true;
}

/**
 * The reasoning depth the deployment should use by default.
 *
 * NVIDIA_THINKING_EFFORT lets a deployment dial the reasoning down to
 * "medium" or "low" without a code change: full effort spends the most
 * tokens on the reasoning trace, which is the best quality but also the
 * slowest.
 */
function configuredEffort(): NvidiaThinkingEffort {
  const value = process.env.NVIDIA_THINKING_EFFORT?.trim().toLowerCase();
  if (value === "medium" || value === "low") return value;
  return "full";
}

/**
 * Calls the configured NVIDIA NIM model and returns only its text content.
 *
 * NVIDIA_MODEL is intentionally required. This client does not select or
 * infer a provider model ID, which keeps deployment configuration explicit.
 */
export async function generateNvidiaText(
  prompt: string,
  options: NvidiaTextOptions = {}
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const configuredModel = process.env.NVIDIA_MODEL?.trim();
  const baseUrl =
    process.env.NVIDIA_BASE_URL?.trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;

  if (!apiKey || !configuredModel) {
    throw new NvidiaRequestError("configuration");
  }

  const modelId = configuredModel;
  const endpoint = `${baseUrl}/chat/completions`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = options.maxTokens ?? MAX_OUTPUT_TOKENS;
  const temperature = options.temperature ?? TEMPERATURE;
  const topP = options.topP ?? TOP_P;
  const thinking = options.thinking ?? configuredThinking();
  const effort = options.effort ?? configuredEffort();

  const messages: Array<{ role: string; content: string }> = [];
  if (options.system?.trim()) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // A deployment that cannot do guided JSON decoding, or that rejects the
    // optional chat template flags, rejects the request instead of ignoring
    // it. The payload is downgraded one step at a time and retried, so the
    // generation survives an older or stricter deployment.
    let jsonMode = options.jsonMode !== false;
    let templateExtras = true;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const body = buildNvidiaRequestBody(modelId, messages, {
        thinking,
        effort,
        maxTokens,
        temperature,
        topP,
        jsonMode,
        templateExtras,
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.ok) {
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new NvidiaRequestError("provider");
        }

        const { text, finishReason, reasoningLength, completionTokens } =
          responseContent(payload);
        // "length" means the output budget was exhausted, which is the
        // truncation case the compact retry path handles.
        if (finishReason === "length") {
          throw new NvidiaRequestError("incomplete", response.status);
        }
        if (finishReason && !SUCCESS_FINISH_REASONS.has(finishReason)) {
          throw new NvidiaRequestError("provider", response.status);
        }
        if (!text) throw new NvidiaRequestError("provider", response.status);

        const durationMs = Date.now() - startedAt;
        if (durationMs >= 30_000) {
          console.info("NVIDIA NIM generation completed slowly", {
            modelId,
            durationMs,
            finishReason,
            thinking,
            effort,
            reasoningLength,
            completionTokens,
            responseLength: text.length,
          });
        }
        return text;
      }

      // A rejected key is a deployment problem, not a transient provider
      // failure, so it must never be retried.
      if (response.status === 401 || response.status === 403) {
        throw new NvidiaRequestError("configuration", response.status);
      }

      if (response.status === 400) {
        const detail = await response.text().catch(() => "");
        const downgradeJson = jsonMode && isJsonModeRejection(detail);
        const downgradeTemplate = templateExtras && isTemplateRejection(detail);
        if (downgradeJson || downgradeTemplate) {
          if (downgradeTemplate) templateExtras = false;
          else jsonMode = false;
          console.warn("NVIDIA NIM rejected a request option; retrying with a simpler payload", {
            modelId,
            dropped: downgradeTemplate ? "chat_template_kwargs" : "response_format",
          });
          continue;
        }
        throw new NvidiaRequestError("provider", response.status);
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS - 1) {
        throw new NvidiaRequestError("provider", response.status);
      }

      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * 2 ** attempt)
      );
    }

    throw new NvidiaRequestError("provider");
  } catch (error) {
    const requestError = error instanceof NvidiaRequestError
      ? error
      : new NvidiaRequestError(
          controller.signal.aborted ? "timeout" : "provider"
        );
    console.error("NVIDIA NIM generation request failed", {
      code: requestError.code,
      status: requestError.status,
      modelId,
      durationMs: Date.now() - startedAt,
    });
    throw requestError;
  } finally {
    clearTimeout(timeout);
  }
}
