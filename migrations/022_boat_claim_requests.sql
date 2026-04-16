ALTER TABLE boats
  ADD COLUMN IF NOT EXISTS claimed_from_boat_id UUID REFERENCES boats(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boats_claimed_from_boat_id
  ON boats (claimed_from_boat_id)
  WHERE claimed_from_boat_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS boat_claim_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id UUID NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  claimant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_listing_id UUID REFERENCES boats(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft_created',
  note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT boat_claim_requests_status_check CHECK (
    status IN ('draft_created', 'reviewing', 'approved', 'rejected')
  ),
  CONSTRAINT boat_claim_requests_unique_claimant UNIQUE (boat_id, claimant_user_id)
);

CREATE INDEX IF NOT EXISTS idx_boat_claim_requests_status_created
  ON boat_claim_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_boat_claim_requests_claimant_created
  ON boat_claim_requests (claimant_user_id, created_at DESC);
