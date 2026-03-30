-- Add expiry to introduction tokens (7 days from creation)
ALTER TABLE introductions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Set expiry for existing pending introductions (7 days from sent_at or now)
UPDATE introductions
SET expires_at = COALESCE(sent_at, created_at, NOW()) + INTERVAL '7 days'
WHERE expires_at IS NULL;

-- Default future rows to 7 days from now
ALTER TABLE introductions ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '7 days';
