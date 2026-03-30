-- Track when imported listings were last seen by the scraper.
-- Boats not seen for 14+ days get marked 'expired' by the daily cleanup job.

ALTER TABLE boats ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Backfill: existing imported boats get their created_at as baseline
UPDATE boats SET last_seen_at = created_at WHERE listing_source = 'imported' AND last_seen_at IS NULL;

-- Index for the expiry query (only imported boats expire)
CREATE INDEX IF NOT EXISTS idx_boats_last_seen ON boats(last_seen_at) WHERE listing_source = 'imported';
