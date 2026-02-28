-- Match scores between buyers and boats
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
  boat_id UUID NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  score REAL NOT NULL CHECK (score BETWEEN 0 AND 1),
  score_breakdown JSONB DEFAULT '{}',
  buyer_action buyer_action NOT NULL DEFAULT 'none',
  seller_notified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buyer_id, boat_id)
);

CREATE INDEX idx_matches_buyer_id ON matches(buyer_id);
CREATE INDEX idx_matches_boat_id ON matches(boat_id);
CREATE INDEX idx_matches_score ON matches(score DESC);
CREATE INDEX idx_matches_buyer_action ON matches(buyer_action);

-- Email introductions
CREATE TABLE introductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  status intro_status NOT NULL DEFAULT 'pending',
  accept_token TEXT UNIQUE,
  decline_token TEXT UNIQUE,
  buyer_message TEXT,
  seller_response TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  intro_sent_at TIMESTAMPTZ
);

CREATE INDEX idx_introductions_match_id ON introductions(match_id);
CREATE INDEX idx_introductions_status ON introductions(status);
CREATE INDEX idx_introductions_accept_token ON introductions(accept_token);
CREATE INDEX idx_introductions_decline_token ON introductions(decline_token);

-- Dreamboard (aspirational saves)
CREATE TABLE dreamboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
  boat_id UUID NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  note TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(buyer_id, boat_id)
);

CREATE INDEX idx_dreamboard_buyer_id ON dreamboard(buyer_id);
