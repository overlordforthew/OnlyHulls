-- Track boat listing views for trending section
ALTER TABLE boats ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;
ALTER TABLE boats ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_boats_view_count ON boats(view_count DESC) WHERE status = 'active';
