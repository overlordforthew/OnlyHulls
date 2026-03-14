# OnlyHulls — Platform Documentation

## What It Is
AI-powered boat matchmaking marketplace. Two-sided: buyers get personalized recommendations via AI interview; sellers list boats with AI-extracted specs. The core value proposition is smarter matching than keyword search — we use semantic vector similarity + rule-based filtering.

## User Types
- **Buyers**: People looking to purchase a boat. Go through AI profiling interview, receive ranked matches.
- **Sellers**: Boat owners/brokers listing boats for sale. Manage listings via seller dashboard.
- **Admins**: Internal (Gil). Full access.

## Core Flows

### Buyer Flow
1. Sign up → Email/password auth (NextAuth v5)
2. Complete AI profiling interview (6-10 conversational turns with Claude Sonnet 4.6)
3. Interview extracts structured profile: use_case, budget_range, boat_type_prefs, spec_preferences, location_prefs, experience_level, deal_breakers, timeline, refit_tolerance
4. Profile converted to 1536-dim embedding (OpenAI text-embedding-3-small)
5. Dashboard shows ranked boat matches (pgvector cosine similarity + rule filters)
6. Each match shows match score + Claude Haiku-generated explanation

### Seller Flow
1. Sign up / login
2. Create boat listing: make, model, year, price, location, description
3. Upload photos/videos (presigned Hetzner Object Storage URLs)
4. AI analyzes listing → generates Boat DNA: specs, character_tags, condition_score, ai_summary, upgrades, known_issues
5. Boat gets embedded (same vector space as buyer profiles)
6. Listing goes live after review

### Matching Engine
- pgvector semantic search: buyer embedding ↔ boat DNA embedding
- Rule-based filters: budget, boat type, location, deal-breakers
- Match score: combined semantic + rule score
- Meilisearch for text search across boat specs

## Key Screens
- `/` — Landing/marketing page
- `/onboarding` — AI profiling interview (chat UI)
- `/dashboard` — Buyer: ranked matches with explanations
- `/boats/[id]` — Individual boat listing page
- `/seller/dashboard` — Seller: manage listings
- `/seller/boats/new` — Create/edit listing with photo upload
- `/admin` — Internal admin panel

## Tech Stack
- Next.js 15, App Router, TypeScript, Tailwind CSS, React 19
- PostgreSQL 17 + pgvector (1536-dim)
- Meilisearch (full-text search)
- Redis (caching)
- Claude Sonnet 4.6 (profiling AI), Claude Haiku 4.5 (match explanations)
- OpenAI text-embedding-3-small
- Stripe (billing + subscriptions)
- Hetzner Object Storage (S3-compatible, photos/videos)
- Resend (email notifications)
- NextAuth v5 (auth)
- next-intl (bilingual)
- Deploy: Coolify auto-deploy on git push to bluemele/OnlyHulls

## Data Models (key relationships)
- User → BuyerProfile (1:1) — profile holds preferences + embedding
- User → Boats (1:many) — seller's listings
- Boat → BoatDNA (1:1) — AI-extracted specs, condition, embedding
- Boat → BoatMedia (1:many) — photos/videos
- BuyerProfile + Boat → Match — pairing with score
- User → AIConversation (1:many) — profiling chat history

## Billing
- Stripe subscriptions (tiers not yet defined — check .env/stripe dashboard)
- JPY pricing not used here (that's NamiBarden) — OnlyHulls uses USD

## Languages
- Bilingual EN/JP via next-intl
