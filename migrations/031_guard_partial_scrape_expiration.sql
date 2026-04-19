CREATE TABLE IF NOT EXISTS import_source_crawl_state (
  source_site TEXT PRIMARY KEY,
  last_full_crawl_at TIMESTAMPTZ,
  last_full_crawl_count INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boats_status_backup_031_partial_scrape_restore AS
SELECT
  b.id,
  b.status,
  b.source_site,
  b.source_name,
  b.last_seen_at,
  b.updated_at,
  NOW() AS backed_up_at
FROM boats b
WHERE false;

INSERT INTO boats_status_backup_031_partial_scrape_restore (
  id,
  status,
  source_site,
  source_name,
  last_seen_at,
  updated_at,
  backed_up_at
)
SELECT
  b.id,
  b.status,
  b.source_site,
  b.source_name,
  b.last_seen_at,
  b.updated_at,
  NOW()
FROM boats b
WHERE b.listing_source = 'imported'
  AND b.status = 'expired'
  AND b.source_site IN (
    'apolloduck_us',
    'boote_yachten',
    'catamarans_com',
    'multihullworld',
    'sailboatlistings',
    'theyachtmarket'
  )
  AND b.updated_at::date BETWEEN DATE '2026-04-17' AND DATE '2026-04-19'
  AND NOT EXISTS (
    SELECT 1
    FROM boats active
    WHERE active.id <> b.id
      AND active.listing_source = 'imported'
      AND active.status = 'active'
      AND active.make = b.make
      AND active.model = b.model
      AND active.year = b.year
      AND active.location_text IS NOT DISTINCT FROM b.location_text
  )
  AND NOT EXISTS (
    SELECT 1
    FROM boats_status_backup_031_partial_scrape_restore existing
    WHERE existing.id = b.id
  );

UPDATE boats b
SET status = 'active',
    updated_at = NOW()
WHERE b.listing_source = 'imported'
  AND b.status = 'expired'
  AND b.source_site IN (
    'apolloduck_us',
    'boote_yachten',
    'catamarans_com',
    'multihullworld',
    'sailboatlistings',
    'theyachtmarket'
  )
  AND b.updated_at::date BETWEEN DATE '2026-04-17' AND DATE '2026-04-19'
  AND NOT EXISTS (
    SELECT 1
    FROM boats active
    WHERE active.id <> b.id
      AND active.listing_source = 'imported'
      AND active.status = 'active'
      AND active.make = b.make
      AND active.model = b.model
      AND active.year = b.year
      AND active.location_text IS NOT DISTINCT FROM b.location_text
  );
