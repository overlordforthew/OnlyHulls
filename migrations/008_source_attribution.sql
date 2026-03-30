-- Source attribution for aggregated listings
-- Supports content/comparison model: every listing links back to its source

ALTER TABLE boats ADD COLUMN IF NOT EXISTS source_site TEXT;
-- Normalized identifier: 'boats_com', 'sailboatlistings', 'yachtworld', 'craigslist', etc.

ALTER TABLE boats ADD COLUMN IF NOT EXISTS source_name TEXT;
-- Human-readable: 'Boats.com', 'Sailboat Listings', 'YachtWorld', etc.

ALTER TABLE boats ADD COLUMN IF NOT EXISTS source_url TEXT;
-- Direct link to original listing on source site

ALTER TABLE boats ADD COLUMN IF NOT EXISTS asking_price_usd DECIMAL(12,2);
-- USD conversion of asking_price for cross-currency comparison

-- Update existing import_url data to populate source_url
UPDATE boats SET source_url = import_url WHERE import_url IS NOT NULL AND source_url IS NULL;

-- Update listing_source for any boat with a source_site
UPDATE boats SET listing_source = 'imported' WHERE source_site IS NOT NULL AND listing_source = 'platform';

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_boats_source_site ON boats(source_site);
CREATE INDEX IF NOT EXISTS idx_boats_listing_source ON boats(listing_source);

-- Prevent duplicate imports: only one listing per source URL
CREATE UNIQUE INDEX IF NOT EXISTS idx_boats_source_url_unique ON boats(source_url) WHERE source_url IS NOT NULL;

-- Prevent fuzzy duplicates: same boat from different sources
-- (make + model + year + location is a strong enough fingerprint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_boats_dedup ON boats(make, model, year, location_text) WHERE listing_source = 'imported';
