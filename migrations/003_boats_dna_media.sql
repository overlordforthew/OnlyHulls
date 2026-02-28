-- Boat listings
CREATE TABLE boats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE,
  hull_id TEXT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INT NOT NULL,
  asking_price DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status boat_status NOT NULL DEFAULT 'draft',
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_text TEXT,
  listing_source listing_source NOT NULL DEFAULT 'platform',
  import_url TEXT,
  is_sample BOOLEAN NOT NULL DEFAULT FALSE,
  dna_embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_boats_seller_id ON boats(seller_id);
CREATE INDEX idx_boats_status ON boats(status);
CREATE INDEX idx_boats_slug ON boats(slug);
CREATE INDEX idx_boats_make_model ON boats(make, model);
CREATE INDEX idx_boats_price ON boats(asking_price);
CREATE INDEX idx_boats_year ON boats(year);

-- Boat DNA (AI-generated structured data)
CREATE TABLE boat_dna (
  boat_id UUID PRIMARY KEY REFERENCES boats(id) ON DELETE CASCADE,
  specs JSONB DEFAULT '{}',
  character_tags TEXT[] DEFAULT '{}',
  condition_score INT CHECK (condition_score BETWEEN 1 AND 10),
  ai_summary TEXT,
  upgrades JSONB DEFAULT '[]',
  known_issues JSONB DEFAULT '[]',
  documentation_status JSONB DEFAULT '{}'
);

-- Boat media (photos/videos)
CREATE TABLE boat_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boat_id UUID NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  type media_type NOT NULL DEFAULT 'image',
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  ai_analysis JSONB,
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_boat_media_boat_id ON boat_media(boat_id);
