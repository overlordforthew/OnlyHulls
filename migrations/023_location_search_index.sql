CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_boats_location_text_trgm
  ON boats USING gin (LOWER(COALESCE(location_text, '')) gin_trgm_ops)
  WHERE status = 'active';
