ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS location_query TEXT,
  ADD COLUMN IF NOT EXISTS currency_code TEXT;

UPDATE saved_searches
SET location_query = COALESCE(location_query, NULLIF(signature::jsonb->>'location', '')),
    currency_code = COALESCE(NULLIF(currency_code, ''), NULLIF(signature::jsonb->>'currency', ''), 'USD')
WHERE location_query IS NULL
   OR currency_code IS NULL
   OR currency_code = '';

UPDATE saved_searches
SET currency_code = 'USD'
WHERE currency_code IS NULL OR currency_code = '';

ALTER TABLE saved_searches
  ALTER COLUMN currency_code SET DEFAULT 'USD',
  ALTER COLUMN currency_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saved_searches_currency_code_check'
  ) THEN
    ALTER TABLE saved_searches
      ADD CONSTRAINT saved_searches_currency_code_check
      CHECK (currency_code IN ('USD', 'EUR', 'GBP'));
  END IF;
END $$;
