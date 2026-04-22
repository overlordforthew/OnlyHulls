-- Phase 4 revert (NOT APPLIED BY DEFAULT).
-- Restores the pre-clamp precision and coordinates captured in 036. Run ONLY if
-- the country-minimum rollout is reversed. Requires that migration 036 ran and
-- its backup table still exists.

UPDATE boats AS b
SET location_geocode_precision = backup.location_geocode_precision,
    location_lat = backup.location_lat,
    location_lng = backup.location_lng,
    location_approximate = backup.location_approximate,
    updated_at = NOW()
FROM boats_geocode_precision_backup_036_marina_clamp AS backup
WHERE b.id = backup.id;
