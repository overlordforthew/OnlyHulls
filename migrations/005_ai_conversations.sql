-- AI conversation history
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type ai_conversation_type NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  extracted_data JSONB,
  status ai_conversation_status NOT NULL DEFAULT 'active',
  token_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_type ON ai_conversations(type);
CREATE INDEX idx_ai_conversations_status ON ai_conversations(status);

-- Add conversation FK references
ALTER TABLE buyer_profiles ADD COLUMN ai_conversation_id UUID REFERENCES ai_conversations(id);
ALTER TABLE boat_dna ADD COLUMN ai_conversation_id UUID REFERENCES ai_conversations(id);

-- IVFFlat indexes for vector similarity search
-- These need data to build properly; creating with lists=100 (suitable for up to ~100K rows)
CREATE INDEX idx_buyer_profiles_embedding ON buyer_profiles
  USING ivfflat (dna_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_boats_embedding ON boats
  USING ivfflat (dna_embedding vector_cosine_ops) WITH (lists = 100);
