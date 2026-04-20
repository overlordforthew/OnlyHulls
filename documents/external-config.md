# OnlyHulls External Config

This document covers the external services and environment variables needed to run OnlyHulls in production.

## Current Production Capability Gates

The live app exposes runtime capability flags at `/api/public/capabilities`.

- `billingEnabled`: true only when Stripe server billing is configured
- `emailEnabled`: true only when Resend delivery is configured
- `openAIEnabled`: true only when OpenAI embeddings are configured
- `storageEnabled`: true only when S3-compatible media storage is configured
- `publicMapEnabled`: true only when the public map feature flag is explicitly enabled

## 1. Core App Runtime

These values should always be present in production.

- `DATABASE_URL`
- `REDIS_URL`
- `MEILISEARCH_API_KEY`
- `MEILISEARCH_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_URL`

Recommended production values:

- `NEXT_PUBLIC_APP_URL=https://onlyhulls.com`
- `NEXTAUTH_URL=https://onlyhulls.com`

Notes:

- `NEXT_PUBLIC_APP_URL` is used for public links, Stripe redirects, email links, sitemap, and robots.
- `NEXTAUTH_URL` is used for auth-related flows and should match the public app URL in production.
- `MEILISEARCH_API_KEY` should not use a placeholder or default-style value.

## 2. Billing and Monetization

Code paths:

- `src/app/api/stripe/checkout/route.ts`
- `src/app/api/stripe/portal/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/lib/stripe/index.ts`
- `src/lib/config/plans.ts`

Required to enable paid plans:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BUYER_PLUS`
- `STRIPE_PRICE_SELLER_STANDARD`
- `STRIPE_PRICE_SELLER_FEATURED`
- `STRIPE_PRICE_BROKER`

Optional today:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Notes:

- Checkout is currently server-side. The publishable key is not on the critical path unless the frontend later embeds Stripe Elements or other client-side Stripe components.
- The fastest revenue path is seller monetization first.

## 3. Email Delivery

Code paths:

- `src/lib/email/resend.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/connect/route.ts`

Required to enable email delivery:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Operational requirements outside the app:

- Verify the sender domain in Resend
- Add required DNS records for SPF and DKIM

Recommended starting sender:

- `OnlyHulls <hello@onlyhulls.com>`

## 4. Media Storage

Code paths:

- `src/lib/storage.ts`
- `src/app/api/upload/route.ts`

Two supported modes:

- local disk via `MEDIA_BACKEND=local`
- S3-compatible storage via `MEDIA_BACKEND=s3` or inferred S3 config

Required to enable local uploads:

- `MEDIA_BACKEND=local`
- `LOCAL_MEDIA_ROOT`

Required to enable S3 uploads:

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Recommended provider:

- Hetzner Object Storage

Important:

- Local disk storage is the free path, but production should use a persistent host mount.
- The current media URL logic expects public object reads or a CDN/bucket endpoint that can serve public files directly.

## 5. Location Geocoding And Public Map

Code paths:

- `scripts/geocode-boat-locations.ts`
- `src/lib/locations/geocoding.ts`
- `src/app/api/boats/map/route.ts`

Required before applying geocodes:

- `LOCATION_GEOCODING_PROVIDER`
- `LOCATION_GEOCODING_USER_AGENT` for `nominatim`
- `LOCATION_GEOCODING_API_KEY` for `opencage`

Required before exposing a buyer-facing map:

- `PUBLIC_MAP_ENABLED=true`
- `NEXT_PUBLIC_MAP_STYLE_URL`
- `NEXT_PUBLIC_MAP_ATTRIBUTION`

Operational notes:

- Keep `PUBLIC_MAP_ENABLED=false` while coordinate coverage is sparse or under review.
- The map marker API intentionally returns `404` when `PUBLIC_MAP_ENABLED` is not true.
- Public map coordinates are gated by geocode precision; city-level results are rounded and marked approximate.
- Use `opencage` for the commercial backfill; OpenCage paid plans allow permanent storage of geocoded results.
- Use public Nominatim only for small validation batches with a monitored User-Agent/contact email and about one request per second.
- First paid validation command shape:
  `LOCATION_GEOCODING_PROVIDER=opencage LOCATION_GEOCODING_API_KEY=... PUBLIC_MAP_ENABLED=false npx tsx scripts/geocode-boat-locations.ts --limit=100 --apply`
- Review `precisionSplit`, `failureReasons`, `geographyMismatches`, and `samplePins` from the command output before increasing the batch size.
- Do not use a geocoder whose terms forbid cached/stored results unless the same provider also supplies the rendered map under compatible terms.
- If you want private objects instead, the app will need a small follow-up change for signed-read URLs or a media proxy.

## 5. AI Matching

Code paths:

- `src/lib/ai/embeddings.ts`
- `src/app/api/user/profile/route.ts`
- `src/lib/listings/shared.ts`

Required to enable real semantic matching:

- `OPENAI_API_KEY`

Current behavior:

- OpenAI is used for embeddings only.
- Without it, the app falls back to heuristic matching where available.
- Match explanations can additionally use local Ollama when configured.

Recommended model path:

- Keep OpenAI embeddings on.
- Keep chat-based onboarding off until the core marketplace loop is stable.
- For local intelligence, add:
  - `AI_PROVIDER=ollama`
  - `OLLAMA_URL`
  - `OLLAMA_CHAT_MODEL`

## 6. Optional Chat Profiling

Code paths:

- `src/app/api/ai/profile-chat/route.ts`
- `scripts/claude-proxy.mjs`

This is optional and should be treated as an advanced feature.

Required if enabled:

- `CLAUDE_PROXY_URL` in the app
- A running host-side proxy based on `scripts/claude-proxy.mjs`
- A working Claude CLI session on the host machine that runs the proxy

Notes:

- The app does not call Anthropic directly today.
- A plain `ANTHROPIC_API_KEY` in the app container does not make this flow work by itself.

## 7. Optional Analytics

Optional:

- `NEXT_PUBLIC_POSTHOG_KEY`

This is useful for funnel visibility but not required to operate the marketplace.

## Recommended Activation Order

1. Set `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, and rotate weak secrets.
2. Enable `RESEND_*` so auth and seller notifications behave correctly.
3. Enable `S3_*` so native listings can carry photos.
4. Enable Stripe paid seller plans.
5. Enable `OPENAI_API_KEY` and run embedding backfills.
6. Revisit optional chat profiling later.
