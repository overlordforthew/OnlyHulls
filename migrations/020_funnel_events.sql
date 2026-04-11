CREATE TABLE IF NOT EXISTS funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  boat_id UUID REFERENCES boats(id) ON DELETE SET NULL,
  introduction_id UUID REFERENCES introductions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_type_created
  ON funnel_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_funnel_events_user_created
  ON funnel_events (user_id, created_at DESC);
