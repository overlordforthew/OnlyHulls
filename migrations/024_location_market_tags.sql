ALTER TABLE boats
  ADD COLUMN IF NOT EXISTS location_country TEXT,
  ADD COLUMN IF NOT EXISTS location_region TEXT,
  ADD COLUMN IF NOT EXISTS location_market_slugs TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location_confidence TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS location_approximate BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS location_geocoded_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'boats_location_confidence_check'
  ) THEN
    ALTER TABLE boats
      ADD CONSTRAINT boats_location_confidence_check
      CHECK (location_confidence IN ('unknown', 'region', 'city', 'exact'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_boats_location_market_slugs
  ON boats USING gin (location_market_slugs)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_boats_location_country
  ON boats (location_country)
  WHERE status = 'active' AND location_country IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_boats_location_region
  ON boats (location_region)
  WHERE status = 'active' AND location_region IS NOT NULL;
