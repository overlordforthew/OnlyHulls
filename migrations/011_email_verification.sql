-- Email verification: token + verified flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email_verify_token ON users (email_verify_token) WHERE email_verify_token IS NOT NULL;

-- Mark all existing users as verified (they registered before this feature)
UPDATE users SET email_verified = true WHERE email_verified = false;
