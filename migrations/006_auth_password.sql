-- Add password_hash column for Auth.js credentials auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Allow clerk_id to be NULL (no longer required with Auth.js)
ALTER TABLE users ALTER COLUMN clerk_id DROP NOT NULL;
