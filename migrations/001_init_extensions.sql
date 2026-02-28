-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Custom enum types
CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'both', 'broker', 'admin');
CREATE TYPE subscription_tier AS ENUM ('free', 'plus', 'pro', 'standard', 'featured', 'broker');
CREATE TYPE experience_level AS ENUM ('novice', 'intermediate', 'experienced', 'professional');
CREATE TYPE timeline AS ENUM ('browsing', '3mo', '6mo', '12mo', 'ready_now');
CREATE TYPE refit_tolerance AS ENUM ('turnkey', 'minor', 'major', 'project');
CREATE TYPE boat_status AS ENUM ('draft', 'pending_review', 'active', 'under_offer', 'sold', 'expired', 'rejected');
CREATE TYPE listing_source AS ENUM ('platform', 'imported');
CREATE TYPE media_type AS ENUM ('image', 'video');
CREATE TYPE buyer_action AS ENUM ('none', 'interested', 'passed', 'dreamboard');
CREATE TYPE ai_conversation_type AS ENUM ('buyer_profile', 'seller_listing', 'broker_profile', 'listing_enhance');
CREATE TYPE ai_conversation_status AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE intro_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- Users table (synced from Clerk)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role user_role NOT NULL DEFAULT 'buyer',
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
