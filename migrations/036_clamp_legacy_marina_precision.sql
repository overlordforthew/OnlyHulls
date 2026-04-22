-- Phase 4 — retarget public geocoding floor to city (country-minimum policy).
-- Clamps every row whose precision is exact/street/marina down to city, rounding
-- coords to the 2-decimal city precision so no pre-clamp coordinate leaks through
-- public map output. Backed by a restore table consumed by 037.

CREATE TABLE IF NOT EXISTS boats_geocode_precision_backup_036_marina_clamp AS
SELECT
  id,
  slug,
  location_geocode_precision,
  location_lat,
  location_lng,
  location_approximate,
  updated_at,
  NOW() AS backed_up_at
FROM boats
WHERE location_geocode_precision IN ('exact', 'street', 'marina');

UPDATE boats
SET location_geocode_precision = 'city',
    location_lat = ROUND(location_lat::numeric, 2),
    location_lng = ROUND(location_lng::numeric, 2),
    location_approximate = TRUE,
    updated_at = NOW()
WHERE location_geocode_precision IN ('exact', 'street', 'marina');
