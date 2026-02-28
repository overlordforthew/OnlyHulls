# OnlyHulls — AI Boat Matchmaking Platform

## Stack
Next.js 15 (App Router, TypeScript, Tailwind) | PostgreSQL 17 + pgvector | Meilisearch | Redis | Auth.js v5 (email/password) | Stripe billing | Claude Sonnet 4.6 (profiling) | Claude Haiku 4.5 (explanations) | OpenAI text-embedding-3-small (1536 dim) | Resend (email) | Hetzner Object Storage (photos)

## Structure
```
src/
  app/              # Next.js App Router pages and API routes
    (public)/       # Public pages (browse, listing detail)
    (dashboard)/    # Authenticated pages (matches, listings, onboarding)
    admin/          # Admin panel
    api/            # API routes (webhooks, AI, etc.)
  lib/              # Shared library code
    db/             # Database client, queries, migrations
    ai/             # AI profiling, embeddings, matching
    matching/       # Match engine (vector + rules)
    email/          # Resend email service
    storage/        # S3 object storage
    stripe/         # Stripe billing helpers
    auth/           # Auth.js helpers
  components/       # React components
  messages/         # i18n translation files
infra/              # Docker infra (PG, Meilisearch, Redis)
migrations/         # SQL migration files
```

## Deploy
- **Coolify auto-deploy** on git push to `bluemele/OnlyHulls`
- Domain: `onlyhulls.com`
- Infra services run via `infra/docker-compose.infra.yml` on host

## Key Patterns
- Server Components by default, Client Components only when needed (interactivity)
- API routes for webhooks and AI streaming
- pgvector for semantic matching (cosine similarity)
- Meilisearch for text search and filtering
- Presigned URLs for photo uploads (no server memory pressure)
- Batch processing for match computation (10 buyers at a time)
