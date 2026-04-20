CREATE OR REPLACE FUNCTION reset_stale_location_geocode()
RETURNS trigger AS $$
BEGIN
  IF OLD.location_geocode_status = 'geocoded'
     AND NEW.location_geocode_status = OLD.location_geocode_status
     AND (
       OLD.location_text IS DISTINCT FROM NEW.location_text
       OR OLD.location_country IS DISTINCT FROM NEW.location_country
       OR OLD.location_region IS DISTINCT FROM NEW.location_region
     ) THEN
    NEW.location_geocode_status = 'pending';
    NEW.location_geocode_provider = NULL;
    NEW.location_geocode_query = NULL;
    NEW.location_geocode_place_name = NULL;
    NEW.location_geocode_precision = NULL;
    NEW.location_geocode_score = NULL;
    NEW.location_geocode_error = 'location_changed';
    NEW.location_geocode_attempted_at = NULL;
    NEW.location_geocode_payload = NULL;

    NEW.location_lat = NULL;
    NEW.location_lng = NULL;
    NEW.location_geocoded_at = NULL;
    NEW.location_approximate = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS boats_reset_stale_location_geocode ON boats;

CREATE TRIGGER boats_reset_stale_location_geocode
BEFORE UPDATE OF location_text, location_country, location_region ON boats
FOR EACH ROW
EXECUTE FUNCTION reset_stale_location_geocode();
