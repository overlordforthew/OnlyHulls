CREATE TABLE IF NOT EXISTS location_geocode_cache_backup_032_admin_boundaries AS
SELECT *, NOW() AS backed_up_at
FROM location_geocode_cache
WHERE precision = 'city'
  AND payload->>'addresstype' IN ('state', 'region', 'province', 'county', 'island');

CREATE TABLE IF NOT EXISTS boats_geocode_precision_backup_032_admin_boundaries AS
SELECT
  id,
  location_geocode_precision,
  location_approximate,
  location_geocode_status,
  location_geocode_payload,
  updated_at,
  NOW() AS backed_up_at
FROM boats
WHERE location_geocode_precision = 'city'
  AND location_geocode_payload->>'addresstype' IN ('state', 'region', 'province', 'county', 'island');

UPDATE location_geocode_cache
SET precision = 'region',
    updated_at = NOW()
WHERE precision = 'city'
  AND payload->>'addresstype' IN ('state', 'region', 'province', 'county', 'island');

UPDATE boats
SET location_geocode_precision = 'region',
    location_approximate = TRUE,
    updated_at = NOW()
WHERE location_geocode_precision = 'city'
  AND location_geocode_payload->>'addresstype' IN ('state', 'region', 'province', 'county', 'island');
