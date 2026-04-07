import { logger } from "@/lib/logger";
import { getPublicAppUrl } from "@/lib/config/urls";

function isConfigured(value?: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;

  const normalized = trimmed.toLowerCase();
  return ![
    "placeholder",
    "changeme",
    "example",
    "dummy",
    "test_placeholder",
    "replace-me",
    "replace_me",
    "sk-placeholder",
    "pk_test_placeholder",
    "re_placeholder",
    "ant-placeholder",
  ].some((marker) => normalized.includes(marker));
}

export interface LLMGenerationResult {
  provider: "ollama" | "openai" | "openrouter";
  model: string;
  output: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
}

interface OpenRouterChoiceMessage {
  content?: unknown;
  reasoning?: unknown;
  reasoning_details?: Array<{ text?: unknown }>;
}

interface OpenRouterChoice {
  message?: OpenRouterChoiceMessage;
  text?: unknown;
}

interface OpenRouterPayload {
  choices?: OpenRouterChoice[];
}

function extractOpenRouterOutput(payload: OpenRouterPayload): string {
  const message = payload?.choices?.[0]?.message || {};
  const reasoningDetails = Array.isArray(message.reasoning_details)
    ? message.reasoning_details
        .map((detail: { text?: unknown }) => String(detail?.text || "").trim())
        .filter(Boolean)
        .join("\n")
    : "";

  return String(
    message.content ||
      message.reasoning ||
      reasoningDetails ||
      payload?.choices?.[0]?.text ||
      ""
  ).trim();
}

function resolvePreferredProvider(): "ollama" | "openai" | "openrouter" | "none" {
  const requested = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (requested === "openrouter" || requested === "openai" || requested === "ollama") {
    return requested;
  }

  if (isConfigured(process.env.OPENROUTER_KEY)) {
    return "openrouter";
  }
  if (isConfigured(process.env.OPENAI_API_KEY)) {
    return "openai";
  }
  if (isConfigured(process.env.OLLAMA_URL)) {
    return "ollama";
  }

  return "none";
}

export function matchIntelligenceEnabled(): boolean {
  const provider = resolvePreferredProvider();

  if (provider === "openai") {
    return isConfigured(process.env.OPENAI_API_KEY);
  }
  if (provider === "openrouter") {
    return isConfigured(process.env.OPENROUTER_KEY);
  }
  if (provider === "ollama") {
    return isConfigured(process.env.OLLAMA_URL);
  }

  return false;
}

export function getMatchIntelligenceProvider(): "ollama" | "openai" | "openrouter" | "none" {
  return matchIntelligenceEnabled() ? resolvePreferredProvider() : "none";
}

async function askOpenAI(systemPrompt: string, userPrompt: string): Promise<LLMGenerationResult> {
  const model = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
  const startedAt = Date.now();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  const payload = await response.json();
  const output =
    String(payload.output_text || "").trim() ||
    String(
      Array.isArray(payload.output)
        ? payload.output
            .flatMap((item: { content?: Array<{ text?: string }> }) =>
              Array.isArray(item?.content) ? item.content.map((part) => part?.text || "") : []
            )
            .join("\n")
        : ""
    ).trim();

  if (!output) {
    throw new Error("OpenAI returned an empty response");
  }

  return {
    provider: "openai",
    model,
    output,
    latencyMs: Date.now() - startedAt,
    tokensIn: payload.usage?.input_tokens,
    tokensOut: payload.usage?.output_tokens,
  };
}

async function askOllama(systemPrompt: string, userPrompt: string): Promise<LLMGenerationResult> {
  const ollamaUrl = (process.env.OLLAMA_URL || "").trim().replace(/\/+$/, "");
  const model = process.env.OLLAMA_CHAT_MODEL || "qwen2.5:7b";
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 30000);
  const startedAt = Date.now();

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      options: {
        temperature: 0.2,
        num_predict: 700,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ollama HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  const payload = await response.json();
  const output = String(payload.message?.content || payload.response || "")
    .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
    .trim();

  if (!output) {
    throw new Error("Ollama returned an empty response");
  }

  return {
    provider: "ollama",
    model,
    output,
    latencyMs: Date.now() - startedAt,
    tokensIn: payload.prompt_eval_count,
    tokensOut: payload.eval_count,
  };
}

async function askOpenRouter(
  systemPrompt: string,
  userPrompt: string
): Promise<LLMGenerationResult> {
  const models = (process.env.OPENROUTER_CHAT_MODEL ||
    "openai/gpt-4.1-mini,openrouter/free")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 30000);
  let lastError: Error | null = null;

  for (const model of models) {
    const startedAt = Date.now();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_KEY || ""}`,
        "Content-Type": "application/json",
        "HTTP-Referer": getPublicAppUrl(),
        "X-Title": "OnlyHulls",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          {
            role: "user",
            content: `${systemPrompt}\n\nMATCH RERANK INPUT:\n${userPrompt}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      lastError = new Error(
        `OpenRouter HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`
      );

      if ([400, 429, 500, 502, 503, 504].includes(response.status)) {
        continue;
      }
      throw lastError;
    }

    const payload = await response.json();
    const output = extractOpenRouterOutput(payload);
    if (!output) {
      lastError = new Error("OpenRouter returned an empty response");
      continue;
    }

    return {
      provider: "openrouter",
      model,
      output,
      latencyMs: Date.now() - startedAt,
      tokensIn: payload.usage?.prompt_tokens,
      tokensOut: payload.usage?.completion_tokens,
    };
  }

  throw lastError || new Error("OpenRouter did not return a usable response");
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string
): Promise<LLMGenerationResult> {
  const provider = getMatchIntelligenceProvider();

  if (provider === "none") {
    throw new Error("Match intelligence is not configured");
  }

  try {
    if (provider === "openai") {
      return await askOpenAI(systemPrompt, userPrompt);
    }
    if (provider === "openrouter") {
      return await askOpenRouter(systemPrompt, userPrompt);
    }

    return await askOllama(systemPrompt, userPrompt);
  } catch (err) {
    logger.error({ err, provider }, "LLM generation failed");
    throw err;
  }
}
