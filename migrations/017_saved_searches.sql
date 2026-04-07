CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  signature TEXT NOT NULL,
  search_query TEXT,
  tag TEXT,
  min_price DECIMAL(12,2),
  max_price DECIMAL(12,2),
  min_year INT,
  max_year INT,
  rig_type TEXT,
  hull_type TEXT,
  sort TEXT NOT NULL DEFAULT 'newest',
  dir TEXT NOT NULL DEFAULT 'desc',
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saved_searches_sort_check CHECK (sort IN ('price', 'size', 'year', 'newest')),
  CONSTRAINT saved_searches_dir_check CHECK (dir IN ('asc', 'desc'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_searches_user_signature
  ON saved_searches (user_id, signature);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_created
  ON saved_searches (user_id, created_at DESC);
