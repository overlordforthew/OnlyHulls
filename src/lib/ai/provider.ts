import OpenAI from "openai";
import { logger } from "@/lib/logger";

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
  provider: "ollama" | "openai";
  model: string;
  output: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
}

export function matchIntelligenceEnabled(): boolean {
  const provider = (process.env.AI_PROVIDER || "ollama").toLowerCase();

  if (provider === "openai") {
    return isConfigured(process.env.OPENAI_API_KEY);
  }

  return isConfigured(process.env.OLLAMA_URL);
}

export function getMatchIntelligenceProvider(): "ollama" | "openai" | "none" {
  if (!matchIntelligenceEnabled()) {
    return "none";
  }

  const provider = (process.env.AI_PROVIDER || "ollama").toLowerCase();
  return provider === "openai" ? "openai" : "ollama";
}

async function askOpenAI(systemPrompt: string, userPrompt: string): Promise<LLMGenerationResult> {
  const model = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const startedAt = Date.now();
  const response = await client.responses.create({
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
  });

  return {
    provider: "openai",
    model,
    output: response.output_text.trim(),
    latencyMs: Date.now() - startedAt,
    tokensIn: response.usage?.input_tokens,
    tokensOut: response.usage?.output_tokens,
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

    return await askOllama(systemPrompt, userPrompt);
  } catch (err) {
    logger.error({ err, provider }, "LLM generation failed");
    throw err;
  }
}
