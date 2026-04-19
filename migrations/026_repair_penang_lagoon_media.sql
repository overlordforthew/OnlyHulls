WITH target_boat AS (
  SELECT id
  FROM boats
  WHERE slug = '2015-lagoon-450-penangmalaysia'
)
UPDATE boats b
SET location_text = 'Penang, Malaysia',
    location_country = 'Malaysia',
    location_region = 'Malaysia',
    location_market_slugs = ARRAY['malaysia']::text[],
    location_confidence = 'city',
    location_approximate = true,
    updated_at = NOW()
FROM target_boat target
WHERE b.id = target.id
  AND LOWER(COALESCE(b.location_text, '')) = 'penangmalaysia';

WITH target_boat AS (
  SELECT id
  FROM boats
  WHERE slug = '2015-lagoon-450-penangmalaysia'
)
UPDATE boat_media bm
SET sort_order = sort_order + 100
USING target_boat target
WHERE bm.boat_id = target.id
  AND bm.type = 'image'
  AND bm.url NOT IN (
    'https://cdnx.theyachtmarket.com/img/165472904/2/lagoon-450-2015-0001.jpg',
    'https://cdnx.theyachtmarket.com/img/174508340/12/lagoon-450-2015-0002.jpg',
    'https://cdnx.theyachtmarket.com/img/174463131/12/lagoon-450-2015-0003.jpg',
    'https://cdnx.theyachtmarket.com/img/174413071/12/lagoon-450-2015-0004.jpg',
    'https://cdnx.theyachtmarket.com/img/174367380/12/lagoon-450-2015-0005.jpg',
    'https://cdnx.theyachtmarket.com/img/174316984/12/lagoon-450-2015-0006.jpg',
    'https://cdnx.theyachtmarket.com/img/174316985/12/lagoon-450-2015-0007.jpg'
  );

WITH target_boat AS (
  SELECT id
  FROM boats
  WHERE slug = '2015-lagoon-450-penangmalaysia'
),
valid_images AS (
  SELECT *
  FROM (VALUES
    ('https://cdnx.theyachtmarket.com/img/165472904/2/lagoon-450-2015-0001.jpg', 0),
    ('https://cdnx.theyachtmarket.com/img/174508340/12/lagoon-450-2015-0002.jpg', 1),
    ('https://cdnx.theyachtmarket.com/img/174463131/12/lagoon-450-2015-0003.jpg', 2),
    ('https://cdnx.theyachtmarket.com/img/174413071/12/lagoon-450-2015-0004.jpg', 3),
    ('https://cdnx.theyachtmarket.com/img/174367380/12/lagoon-450-2015-0005.jpg', 4),
    ('https://cdnx.theyachtmarket.com/img/174316984/12/lagoon-450-2015-0006.jpg', 5),
    ('https://cdnx.theyachtmarket.com/img/174316985/12/lagoon-450-2015-0007.jpg', 6)
  ) AS image(url, sort_order)
)
INSERT INTO boat_media (boat_id, type, url, sort_order)
SELECT target.id, 'image', valid_images.url, valid_images.sort_order
FROM target_boat target
CROSS JOIN valid_images
WHERE NOT EXISTS (
  SELECT 1
  FROM boat_media bm
  WHERE bm.boat_id = target.id
    AND bm.type = 'image'
    AND bm.url = valid_images.url
);

WITH target_boat AS (
  SELECT id
  FROM boats
  WHERE slug = '2015-lagoon-450-penangmalaysia'
),
valid_images AS (
  SELECT *
  FROM (VALUES
    ('https://cdnx.theyachtmarket.com/img/165472904/2/lagoon-450-2015-0001.jpg', 0),
    ('https://cdnx.theyachtmarket.com/img/174508340/12/lagoon-450-2015-0002.jpg', 1),
    ('https://cdnx.theyachtmarket.com/img/174463131/12/lagoon-450-2015-0003.jpg', 2),
    ('https://cdnx.theyachtmarket.com/img/174413071/12/lagoon-450-2015-0004.jpg', 3),
    ('https://cdnx.theyachtmarket.com/img/174367380/12/lagoon-450-2015-0005.jpg', 4),
    ('https://cdnx.theyachtmarket.com/img/174316984/12/lagoon-450-2015-0006.jpg', 5),
    ('https://cdnx.theyachtmarket.com/img/174316985/12/lagoon-450-2015-0007.jpg', 6)
  ) AS image(url, sort_order)
)
UPDATE boat_media bm
SET sort_order = valid_images.sort_order
FROM target_boat target
CROSS JOIN valid_images
WHERE bm.boat_id = target.id
  AND bm.type = 'image'
  AND bm.url = valid_images.url;
