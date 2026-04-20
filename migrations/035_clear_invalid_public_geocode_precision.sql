UPDATE boats
SET location_geocode_precision = 'unknown',
    updated_at = NOW()
WHERE location_geocode_precision IN ('exact', 'street', 'marina')
  AND NOT (
    location_lat IS NOT NULL
    AND location_lng IS NOT NULL
    AND location_lat BETWEEN -90 AND 90
    AND location_lng BETWEEN -180 AND 180
  );
