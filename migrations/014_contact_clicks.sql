-- Contact intent tracking for scraped listings
-- Logs every "Contact Owner" click (guest + authenticated) for trending/reco signals
CREATE TABLE IF NOT EXISTS contact_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boat_id UUID NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  click_type TEXT NOT NULL CHECK (click_type IN ('guest', 'save_and_continue')),
  source_site TEXT,
  source_url TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_clicks_boat_id ON contact_clicks(boat_id);
CREATE INDEX IF NOT EXISTS idx_contact_clicks_created_at ON contact_clicks(created_at DESC);
