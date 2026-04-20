ALTER TABLE boat_media
  ADD COLUMN IF NOT EXISTS fetch_status TEXT NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS content_length BIGINT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'boat_media_fetch_status_check'
  ) THEN
    ALTER TABLE boat_media
      ADD CONSTRAINT boat_media_fetch_status_check
      CHECK (fetch_status IN ('unchecked', 'ok', 'failed', 'blocked'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_boat_media_fetch_status
  ON boat_media (fetch_status, last_checked_at)
  WHERE type = 'image';
