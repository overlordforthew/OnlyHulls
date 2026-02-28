-- Buyer profiles with DNA embedding
CREATE TABLE buyer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  use_case TEXT[] DEFAULT '{}',
  budget_range JSONB DEFAULT '{}',
  boat_type_prefs JSONB DEFAULT '{}',
  spec_preferences JSONB DEFAULT '{}',
  location_prefs JSONB DEFAULT '{}',
  experience_level experience_level,
  deal_breakers TEXT[] DEFAULT '{}',
  timeline timeline DEFAULT 'browsing',
  refit_tolerance refit_tolerance DEFAULT 'turnkey',
  dna_embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_buyer_profiles_user_id ON buyer_profiles(user_id);
