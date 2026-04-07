CREATE TABLE IF NOT EXISTS match_ai_signals (
  match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  ai_score REAL NOT NULL CHECK (ai_score >= 0 AND ai_score <= 1),
  verdict TEXT NOT NULL CHECK (verdict IN ('strong_fit', 'workable_fit', 'weak_fit', 'reject')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_ai_signals_updated ON match_ai_signals (updated_at DESC);
