-- Email preferences for mailing list system
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_alerts VARCHAR(20) DEFAULT 'none';
-- Values: 'none', 'weekly', 'instant'

ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN DEFAULT true;

-- Listing date for boats (when it was originally listed, not just our created_at)
ALTER TABLE boats ADD COLUMN IF NOT EXISTS listing_date DATE;

-- Outreach tracking for scraper pipeline
CREATE TABLE IF NOT EXISTS outreach_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL, -- 'boats_com', 'yachtworld', 'sailboatlistings'
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  listing_url TEXT,
  boat_info JSONB,
  status VARCHAR(20) DEFAULT 'pending', -- pending, emailed, called, converted, declined
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_contacts(status);
CREATE INDEX IF NOT EXISTS idx_outreach_email ON outreach_contacts(email);
