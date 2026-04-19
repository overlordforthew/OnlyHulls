WITH target_boat AS (
  SELECT id
  FROM boats
  WHERE slug = '2015-lagoon-450-penangmalaysia'
),
fixed_media AS (
  SELECT
    bm.id,
    bm.url AS thumbnail_url,
    REGEXP_REPLACE(bm.url, '/img/([0-9]+)/12/', '/img/\1/2/') AS full_size_url
  FROM boat_media bm
  JOIN target_boat target ON target.id = bm.boat_id
  WHERE bm.type = 'image'
    AND bm.url LIKE 'https://cdnx.theyachtmarket.com/img/%/12/%'
)
UPDATE boat_media bm
SET url = fixed_media.full_size_url,
    thumbnail_url = COALESCE(bm.thumbnail_url, fixed_media.thumbnail_url),
    fetch_status = 'unchecked',
    http_status = NULL,
    content_type = NULL,
    content_length = NULL,
    blocked_reason = NULL,
    last_checked_at = NULL
FROM fixed_media
WHERE bm.id = fixed_media.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM boat_media bm
    JOIN boats b ON b.id = bm.boat_id
    WHERE b.slug = '2015-lagoon-450-penangmalaysia'
      AND bm.type = 'image'
      AND bm.url LIKE 'https://cdnx.theyachtmarket.com/img/%/12/%'
  ) THEN
    RAISE EXCEPTION 'Penang Lagoon gallery still has thumbnail-sized YachtMarket image URLs';
  END IF;
END $$;
