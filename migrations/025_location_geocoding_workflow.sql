ALTER TABLE boats
  ADD COLUMN IF NOT EXISTS location_geocode_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS location_geocode_provider TEXT,
  ADD COLUMN IF NOT EXISTS location_geocode_query TEXT,
  ADD COLUMN IF NOT EXISTS location_geocode_place_name TEXT,
  ADD COLUMN IF NOT EXISTS location_geocode_precision TEXT,
  ADD COLUMN IF NOT EXISTS location_geocode_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_geocode_error TEXT,
  ADD COLUMN IF NOT EXISTS location_geocode_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_geocode_payload JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'boats_location_geocode_status_check'
  ) THEN
    ALTER TABLE boats
      ADD CONSTRAINT boats_location_geocode_status_check
      CHECK (location_geocode_status IN ('pending', 'skipped', 'geocoded', 'failed', 'review'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'boats_location_geocode_precision_check'
  ) THEN
    ALTER TABLE boats
      ADD CONSTRAINT boats_location_geocode_precision_check
      CHECK (
        location_geocode_precision IS NULL
        OR location_geocode_precision IN ('exact', 'street', 'marina', 'city', 'region', 'country', 'unknown')
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS location_geocode_cache (
  query_key TEXT PRIMARY KEY,
  query_text TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('geocoded', 'failed', 'review')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  precision TEXT CHECK (
    precision IS NULL
    OR precision IN ('exact', 'street', 'marina', 'city', 'region', 'country', 'unknown')
  ),
  score DOUBLE PRECISION,
  place_name TEXT,
  payload JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boats_location_geocode_status
  ON boats (location_geocode_status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_boats_location_geocode_candidate
  ON boats (location_confidence, location_geocode_status, updated_at DESC)
  WHERE status = 'active'
    AND location_text IS NOT NULL
    AND location_lat IS NULL
    AND location_lng IS NULL;

CREATE INDEX IF NOT EXISTS idx_boats_location_coordinates
  ON boats (location_lat, location_lng)
  WHERE status = 'active'
    AND location_lat IS NOT NULL
    AND location_lng IS NOT NULL;
