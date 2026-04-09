-- Only active imported listings should participate in fuzzy dedupe.
-- Expired historical imports should not block make/model normalization or reimports.

DROP INDEX IF EXISTS idx_boats_dedup;

CREATE UNIQUE INDEX IF NOT EXISTS idx_boats_dedup
  ON boats(make, model, year, location_text)
  WHERE listing_source = 'imported' AND status = 'active';
