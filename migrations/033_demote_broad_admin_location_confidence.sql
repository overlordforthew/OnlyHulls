CREATE TABLE IF NOT EXISTS boats_location_confidence_backup_033_broad_admin AS
SELECT
  id,
  location_text,
  location_country,
  location_region,
  location_market_slugs,
  location_confidence,
  updated_at,
  NOW() AS backed_up_at
FROM boats
WHERE location_confidence = 'city'
  AND location_country = 'United States'
  AND LOWER(TRIM(location_text)) IN (
    'connecticut',
    'maine',
    'maryland',
    'michigan',
    'ohio',
    'rhode island',
    'virginia'
  );

UPDATE boats
SET location_confidence = 'region',
    location_approximate = TRUE,
    updated_at = NOW()
WHERE location_confidence = 'city'
  AND location_country = 'United States'
  AND LOWER(TRIM(location_text)) IN (
    'connecticut',
    'maine',
    'maryland',
    'michigan',
    'ohio',
    'rhode island',
    'virginia'
  );
