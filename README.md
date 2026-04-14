# OnlyHulls

OnlyHulls is a sailing-focused marketplace and buyer-matching platform built on Next.js. It combines public inventory browsing, seller listings, buyer profiles, AI-assisted matching, and direct buyer-to-seller contact without broker commissions.

## Stack

- Next.js 16 App Router
- TypeScript and Tailwind CSS 4
- PostgreSQL 17 with `pgvector`
- Meilisearch for browse/search
- Redis for rate limiting and short-lived state
- Auth.js v5
- Stripe billing
- Resend or SMTP email
- Local disk or S3-compatible media storage

## Local Setup

1. Copy `.env.example` to `.env` and fill the required values.
2. Start local infra:

```bash
docker compose -f docker-compose.dev.yml up -d db meilisearch redis
```

3. Apply migrations:

```bash
npm ci
npm run db:migrate
```

4. Optional seed for a fresh local database:

```bash
npm run db:seed
```

5. Start the app:

```bash
npm run dev
```

The default local ports used by the repo are:

- App: `http://127.0.0.1:3000`
- Postgres: `127.0.0.1:5433`
- Meilisearch: `127.0.0.1:7701`
- Redis: `127.0.0.1:6380`

## Validation

Run the same core checks used in CI:

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:browser
```

Production smoke can be run after deploy:

```bash
npm run test:browser:prod
```

## Imports And Maintenance

Common data workflows:

```bash
npm run db:import -- <scraped-json-file> <source-key>
npm run db:clean-imports
npm run db:resolve-import-duplicates
npm run db:backfill-embeddings
npm run db:recompute-matches
```

Imported `source_url` and image URLs are sanitized before they are written, and imported boat records are sanitized again on read to protect legacy rows.

## Deploy

- `origin/main` is the deploy branch.
- Coolify auto-deploys from GitHub after pushes to `main`.
- Public deploy diagnostics are exposed at `/api/public/deploy-health`.
- GitHub Actions runs the local CI gate on pushes and pull requests, then runs post-deploy production smoke on pushes to `main`.

## Operational Notes

- `/api/boats` now emits `Server-Timing` and `X-OnlyHulls-Search-Mode` headers to make live search behavior easier to inspect.
- The admin dashboard surfaces the active build SHA, branch, version, runtime, and a direct link to deploy diagnostics.
- The public `/match` route logs render timing and featured-boat query timing on the server for production troubleshooting.
