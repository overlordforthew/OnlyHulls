import { query } from "@/lib/db";

export async function logLLMResponse(params: {
  scopeType: string;
  scopeId: string;
  taskType: string;
  provider: string;
  model: string;
  promptHash: string;
  inputSummary: string;
  response: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  wasSelected?: boolean;
  selectionReason?: string | null;
}) {
  await query(
    `INSERT INTO llm_responses (
      scope_type, scope_id, task_type, provider, model, prompt_hash,
      input_summary, response, latency_ms, tokens_in, tokens_out,
      was_selected, selection_reason
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      params.scopeType,
      params.scopeId,
      params.taskType,
      params.provider,
      params.model,
      params.promptHash,
      params.inputSummary,
      params.response,
      params.latencyMs,
      params.tokensIn || null,
      params.tokensOut || null,
      params.wasSelected ?? true,
      params.selectionReason || null,
    ]
  );
}
