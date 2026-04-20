DO $$
DECLARE
  current_primary_key TEXT;
BEGIN
  SELECT conname
  INTO current_primary_key
  FROM pg_constraint
  WHERE conrelid = 'location_geocode_cache'::regclass
    AND contype = 'p'
  LIMIT 1;

  IF current_primary_key IS NOT NULL THEN
    EXECUTE FORMAT('ALTER TABLE location_geocode_cache DROP CONSTRAINT %I', current_primary_key);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'location_geocode_cache_pkey'
      AND conrelid = 'location_geocode_cache'::regclass
  ) THEN
    ALTER TABLE location_geocode_cache
      ADD CONSTRAINT location_geocode_cache_pkey PRIMARY KEY (query_key, provider);
  END IF;
END $$;
