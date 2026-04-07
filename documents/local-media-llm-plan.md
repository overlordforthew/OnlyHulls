# OnlyHulls Local Media + Local LLM Plan

This is the recommended path if we want to avoid paid object storage and move OnlyHulls toward a MasterCommander-style local-first AI stack.

## Bottom Line

Use:

- local disk for seller-uploaded media
- Postgres as the system-of-record database
- local Ollama for AI generation
- Postgres `pgvector` or a separate local vector store only if we truly need retrieval over a document corpus

Do not use:

- Postgres as a blob store for images
- a second database just for the sake of copying MasterCommander

## Why Not Store Images In Postgres

Storing image bytes directly in Postgres is the wrong tradeoff here.

- Backups get large fast
- WAL volume grows sharply
- restores get slower
- app and DB I/O compete with each other
- image serving becomes less cache-friendly

For OnlyHulls, the free path is local filesystem storage on the Hetzner host, not database blobs.

## Current Reality

As of 2026-04-07:

- OnlyHulls already uses Postgres with `pgvector`
- `boats.dna_embedding` and `buyer_profiles.dna_embedding` already exist
- seller media metadata already lives in `boat_media`
- the live Hetzner host currently has about `27 GB` free on `/`
- imported listings already use remote image URLs, so local storage is only needed for native seller uploads

That means local media is viable now if we keep scope sane.

## Recommended Media Architecture

### Phase 1

Store seller-uploaded images on a persistent host directory and serve them from the app domain.

Suggested host path:

- `/srv/onlyhulls/media`

Suggested container mount:

- host `/srv/onlyhulls/media`
- container `/media-data`

Suggested public URL shape:

- `https://onlyhulls.com/media/boats/<boat-id>/images/<timestamp>.jpg`

### Why This Works

- effectively free beyond existing server disk
- same-origin image serving
- no extra vendor billing
- simple backup story
- matches current `boat_media.url` design

### Constraints

- do not support seller video in phase 1
- resize and compress uploads on the server
- enforce per-plan photo caps already present in app logic
- add file-size caps to protect disk

## Media Rollout Recommendation

### Phase 1 media rules

- images only
- max `8 MB` uploaded file size
- convert large uploads to web-optimized JPEG/WebP variants
- keep one original and one display-sized derivative only if needed
- keep public URLs stable in `boat_media.url`

### Estimated capacity

If native listings average roughly `15 MB` to `40 MB` after processing, then `27 GB` of free disk is enough for several hundred seller listings before we need a larger volume or pruning policy.

That is acceptable for launch because imported listings keep using third-party image URLs.

## Required App Changes For Local Media

The current app assumes S3-style presigned uploads.

Current S3-specific touchpoints:

- `src/lib/storage.ts`
- `src/app/api/upload/route.ts`
- `src/lib/listings/shared.ts`

Recommended replacement:

1. Introduce a storage backend abstraction:
   - `storageBackend = "local" | "s3"`
2. Add local-storage env vars:
   - `MEDIA_BACKEND=local`
   - `LOCAL_MEDIA_ROOT=/media-data`
   - `LOCAL_MEDIA_BASE_PATH=/media`
3. Replace presigned-upload-only flow with one of:
   - direct multipart upload to app route
   - or two-step create + upload route for local files
4. Relax media URL validation so same-origin `/media/...` URLs are allowed
5. Add a read route:
   - `GET /media/[...path]`
   - reads from mounted disk
   - sets `Cache-Control`

## Recommended Local LLM Architecture

Mirror MasterCommander's philosophy, not its exact schema.

MasterCommander pattern:

- local Ollama for inference
- Postgres for operational data and LLM response logs
- local vector store only when handling a knowledge corpus

For OnlyHulls:

- use Ollama for listing enrichment, buyer summarization, and structured extraction
- keep marketplace data in Postgres
- log LLM activity in new relational tables
- use vector search only where it materially improves matching or retrieval

## Important Constraint: Current Embedding Columns Are OpenAI-Shaped

OnlyHulls currently stores embeddings in fixed `vector(1536)` columns.

That matches the current OpenAI embedding path. If we switch to a local embedding model with a different dimensionality, we must either:

1. migrate those columns and indexes to the local model's dimensions, or
2. keep heuristic matching temporarily while local LLM handles generation tasks, or
3. move retrieval vectors into a separate vector store

Recommendation:

- use local Ollama first for generation and enrichment
- keep current heuristic matching path live
- then migrate the embedding layer deliberately instead of rushing it

## Suggested Ollama Setup

Run Ollama on the Hetzner host or in a dedicated service container, bound to localhost.

Suggested endpoint:

- `http://127.0.0.1:11434`

Use it for:

- listing summary generation
- listing spec cleanup and normalization
- buyer profile summarization
- match explanation generation
- admin moderation assist

Do not make core platform behavior depend entirely on the LLM.

## Recommended OnlyHulls AI Data Structure

These are the MasterCommander-style tables I would add for OnlyHulls.

### `llm_responses`

Purpose:

- log prompts, provider, model, latency, selection path, output, and operator rating

Why:

- exactly the same observability benefit MasterCommander gets

Suggested columns:

- `id`
- `scope_type`
- `scope_id`
- `task_type`
- `provider`
- `model`
- `prompt_hash`
- `input_summary`
- `response`
- `latency_ms`
- `tokens_in`
- `tokens_out`
- `was_selected`
- `selection_reason`
- `rating`
- `rating_comment`
- `created_at`

### `listing_ai_profiles`

Purpose:

- structured AI output for seller and imported listings

Suggested fields:

- `boat_id`
- `summary`
- `use_cases`
- `pros`
- `cons`
- `tags`
- `normalized_specs`
- `confidence`
- `source_version`
- `updated_at`

### `buyer_ai_profiles`

Purpose:

- normalized buyer intent summaries separate from the raw questionnaire

Suggested fields:

- `buyer_profile_id`
- `plain_english_summary`
- `must_haves`
- `nice_to_haves`
- `deal_breakers`
- `inferred_use_cases`
- `updated_at`

### `match_explanations`

Purpose:

- store human-readable reasons for why a boat matched a buyer

Suggested fields:

- `match_id`
- `summary`
- `strengths`
- `risks`
- `confidence`
- `updated_at`

### `knowledge_documents`

Purpose:

- optional corpus for manuals, guides, broker FAQs, and scraped knowledge

Suggested fields:

- `id`
- `source_type`
- `source_url`
- `title`
- `checksum`
- `status`
- `created_at`

### `knowledge_chunks`

Purpose:

- optional chunked retrieval records if we later build a local RAG system

Suggested fields:

- `document_id`
- `chunk_index`
- `content`
- `metadata`
- `embedding`

Recommendation:

- do not build this first
- build it only if we actually need retrieval over manuals, site content, or broker knowledge

## What "Similar To MasterCommander" Should Mean Here

The right translation is:

- local-first model execution
- relational logging of model outputs
- explicit fallback paths
- operational data stays in Postgres
- vector storage added only where needed

The wrong translation is:

- copy every MasterCommander component into OnlyHulls
- add Chroma or Qdrant before we know we need retrieval
- use a local model for tasks that deterministic code already handles well

## Recommended Build Order

1. Add local media backend with persistent host mount
2. Disable seller video for now
3. Add Ollama service on Hetzner
4. Introduce a provider abstraction for generation:
   - `openai`
   - `ollama`
5. Add `llm_responses` table and response logging
6. Add `listing_ai_profiles` and `buyer_ai_profiles`
7. Generate match explanations for existing matches
8. Revisit embeddings and vector search after local generation is stable

## What I Recommend Next

Build this in two tracks:

### Track A: Media

- replace S3-only uploads with local filesystem uploads
- mount persistent storage into the app container
- serve files from `/media/...`

### Track B: AI

- add Ollama as a local inference provider
- add `llm_responses`
- add structured listing and buyer AI profile tables
- keep the current heuristic matcher until we deliberately migrate embeddings

That is the cleanest path to "free storage + local AI" without destabilizing the rest of the app.
