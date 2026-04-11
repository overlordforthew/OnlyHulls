# OnlyHulls MCP Product Plan

## Goal

Add a controlled MCP layer so external AI agents can work with OnlyHulls data safely and usefully.

The product goal is not "AI for everything." It is:

- better buyer qualification
- better seller productivity
- broker workflow leverage
- premium packaging for power users

## Principles

- MCP is a premium workflow layer, not a requirement to use the site.
- The built-in OnlyHulls UX must still work without any external AI.
- Each MCP tool must be scoped by role and ownership.
- Default access should be read-heavy and write-light.
- High-risk actions must stay outside MCP until trust, audit, and billing are mature.

## User Tiers

### Buyer Plus

MCP value:

- let personal agents refine buyer profile
- run saved searches automatically
- compare boats with user-specific criteria
- summarize matches and tradeoffs

Allowed MCP surface:

- profile read/write
- match read
- boat search
- boat compare
- save search
- shortlist actions

### Seller Creator / Featured

MCP value:

- improve listing quality
- rewrite copy
- manage listing details
- triage and respond to leads
- analyze listing performance

Allowed MCP surface:

- listing read/write for owned listings
- listing validation
- lead read/write for owned listings
- analytics read
- draft reply generation

### Broker

MCP value:

- manage multiple listings
- manage buyer pipelines
- create client shortlists
- generate intros and outreach
- sync external CRM workflows

Allowed MCP surface:

- seller tools across owned/assigned inventory
- buyer/client notes
- lead stage updates
- pipeline summaries
- shortlist generation
- introduction request helpers

## Packaging

### Phase 1 pricing

- Buyer Plus: include buyer agent tools
- Seller Creator: include listing assistant + basic lead tools
- Seller Featured: include advanced listing assistant + analytics tools
- Broker: include full MCP access for inventory, leads, and pipeline tools

### Suggested positioning

- Buyer Plus: "Bring your AI into your boat search"
- Seller Creator: "Use AI to improve listings and manage leads"
- Broker: "Connect your agent workflow to live inventory and pipeline data"

## Core MCP Resources

### Buyer resources

- `buyer_profile`
- `buyer_matches`
- `saved_searches`
- `favorite_boats`
- `boat_compare_sets`

### Seller resources

- `my_listings`
- `listing_details`
- `listing_media`
- `listing_analytics`
- `listing_leads`

### Broker resources

- `assigned_inventory`
- `client_profiles`
- `client_shortlists`
- `pipeline_summary`
- `lead_activity`

## MCP Tool Set

## Buyer tools

### `get_buyer_profile`

Returns the authenticated buyer's current structured profile.

### `update_buyer_profile`

Allowed fields:

- use case
- budget
- preferred boat types
- length/year preferences
- location preferences
- experience
- timeline

Rules:

- trigger match recompute after successful update
- maintain audit trail for profile updates

### `search_boats`

Inputs:

- query
- filters
- sort
- limit

Rules:

- same quality filters as public site
- support currency preference

### `list_matches`

Inputs:

- sort
- limit
- offset

Returns:

- boat summary
- match score
- AI explanation
- source attribution

### `compare_boats`

Inputs:

- boat ids

Returns:

- specs table
- pricing table
- key differences
- likely fit summary

### `save_search`

Inputs:

- query
- filters
- label

### `list_saved_searches`

Returns buyer's saved searches and recent result deltas.

### `update_match_action`

Allowed actions:

- interested
- passed

## Seller tools

### `list_my_listings`

Returns seller-owned listings with status and health indicators.

### `get_listing`

Returns full listing details including:

- specs
- media
- status
- analytics snapshot

### `update_listing`

Allowed fields:

- title inputs
- make/model/year
- price
- description
- specs
- location
- media metadata
- video URLs

Rules:

- only seller-owned listings
- validation runs before publish/review

### `validate_listing`

Returns:

- missing required fields
- photo count issues
- duplicate-risk signal
- publish readiness

### `get_listing_analytics`

Returns:

- views
- saves
- lead count
- accepted intros
- freshness
- response time

### `list_listing_leads`

Returns:

- lead stage
- timestamps
- notes
- intro status

### `update_lead_stage`

Allowed transitions:

- new
- contacted
- qualified
- accepted
- lost
- closed

### `draft_seller_reply`

Inputs:

- lead id
- tone
- response goal

Returns draft only, not auto-send.

## Broker tools

### `list_inventory`

Returns all broker-accessible listings.

### `list_pipeline`

Returns lead pipeline across listings and clients.

### `match_client_to_inventory`

Inputs:

- client profile
- inventory subset optional

Returns ranked shortlist.

### `create_shortlist_note`

Creates structured shortlist notes for a client.

### `create_intro_request`

Creates a proposed introduction workflow entry, not an irreversible send.

## Permissions Model

## Auth model

- MCP sessions require OnlyHulls auth plus API token or OAuth-style session binding.
- Tokens must be user-bound, not global.
- Every tool call must resolve to a concrete user id and role.

## Role enforcement

### Buyer

Can:

- read/update own profile
- read own matches
- manage own saved searches
- mark own actions

Cannot:

- edit listings
- access other users' leads
- access admin tools

### Seller

Can:

- read/update owned listings
- read/update owned lead pipeline
- read owned analytics

Cannot:

- edit other sellers' listings
- perform admin moderation
- access unrelated buyer private data

### Broker

Can:

- use broader inventory and client workflow tools if explicitly assigned

Cannot:

- bypass ownership/assignment rules
- access admin-only controls

### Admin

Do not expose broad admin MCP initially.

If admin MCP is ever added, it should be separate and heavily audited.

## Audit and safety

Every MCP write action should log:

- actor user id
- tool name
- target object id
- changed fields
- timestamp
- source client

High-risk actions should be blocked or staged:

- deleting listings
- changing billing
- changing subscriptions
- admin moderation decisions
- irreversible external sends

## API Design

## Recommended route namespace

- `/api/mcp/buyer/...`
- `/api/mcp/seller/...`
- `/api/mcp/broker/...`

## Suggested initial endpoints

### Buyer

- `GET /api/mcp/buyer/profile`
- `POST /api/mcp/buyer/profile`
- `GET /api/mcp/buyer/matches`
- `GET /api/mcp/buyer/search`
- `POST /api/mcp/buyer/compare`
- `GET /api/mcp/buyer/saved-searches`
- `POST /api/mcp/buyer/saved-searches`
- `POST /api/mcp/buyer/matches/:id/action`

### Seller

- `GET /api/mcp/seller/listings`
- `GET /api/mcp/seller/listings/:id`
- `PATCH /api/mcp/seller/listings/:id`
- `POST /api/mcp/seller/listings/:id/validate`
- `GET /api/mcp/seller/listings/:id/analytics`
- `GET /api/mcp/seller/listings/:id/leads`
- `POST /api/mcp/seller/leads/:id/stage`
- `POST /api/mcp/seller/leads/:id/draft-reply`

### Broker

- `GET /api/mcp/broker/inventory`
- `GET /api/mcp/broker/pipeline`
- `POST /api/mcp/broker/match-client`
- `POST /api/mcp/broker/shortlists`
- `POST /api/mcp/broker/intro-request`

## Data Contracts

Keep contracts simple and structured:

- avoid giant raw blobs
- prefer normalized JSON with explicit fields
- include ids, status, timestamps, and ownership context
- include source attribution for imported boats

## Product Rollout

### Phase 1

- buyer profile read/write
- boat search
- match retrieval
- saved searches
- seller listing read/write
- seller lead stage update

This is enough to make MCP useful and monetizable.

### Phase 2

- compare endpoint
- seller analytics endpoint
- draft seller reply tool
- broker shortlist tool

### Phase 3

- CRM sync patterns
- webhook/event subscriptions
- automation-friendly batch endpoints

## UI/Commercial Changes Needed

### Buyer UI

Add premium messaging:

- "Use your own AI agent with OnlyHulls"
- "Connect Claude / ChatGPT-compatible tools"

### Seller UI

Add workflow messaging:

- "Use AI to improve listing quality"
- "Manage leads with your own agent"

### Broker UI

Add a dedicated broker/MCP settings page:

- API token management
- activity log
- connection docs

## Technical Recommendation

Build MCP on top of the existing app routes and domain logic first.

Do not build a separate parallel backend.

Use:

- existing auth/session model
- existing listing/match/search services
- thin role-specific wrappers
- explicit audit logging

## Recommended MVP

If only one MVP gets built, build this:

- buyer profile read/write
- boat search
- matches read
- saved searches read/write
- seller listing read/write
- seller lead stage update

That is the smallest surface that is both useful and sellable.

## Success Metrics

- Buyer Plus conversion rate
- Seller plan conversion rate
- average seller response time
- saved search creation rate
- MCP token activation rate
- repeat MCP usage per account
- broker seat retention
