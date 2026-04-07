CREATE TABLE IF NOT EXISTS llm_responses (
  id BIGSERIAL PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id UUID NOT NULL,
  task_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_hash TEXT,
  input_summary TEXT,
  response TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  was_selected BOOLEAN NOT NULL DEFAULT true,
  selection_reason TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  rating_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_responses_scope ON llm_responses (scope_type, scope_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_responses_task ON llm_responses (task_type, created_at DESC);

CREATE TABLE IF NOT EXISTS match_explanations (
  match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  strengths JSONB NOT NULL DEFAULT '[]',
  risks JSONB NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0.5,
  provider TEXT NOT NULL DEFAULT 'rules',
  model TEXT NOT NULL DEFAULT 'fallback',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_explanations_updated ON match_explanations (updated_at DESC);
