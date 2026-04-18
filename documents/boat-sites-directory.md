# Boat Listing Sites — Operational Source Directory

**Last updated: 2026-04-18**
**Purpose:** This is the operational source-of-truth for marketplace acquisition decisions in OnlyHulls.

This document is a portfolio, not a bucket. A site being technically reachable does **not** mean it belongs in the daily pipeline.

## Operating Principles

- Keep the current buyer-visible sources stable before adding more volume.
- Promote only sources that clear quality gates with real buyer-visible inventory.
- Test Rightboat carefully with throttling before promoting it.
- Keep Boats Group properties in a separate commercial/API lane.
- Prefer sources with clean price, location, image, and detail pages over raw listing count.
- Avoid making the business depend on heavily blocked or legally risky sources.

## Status Legend

- **ACTIVE** = already in the daily scrape/import pipeline
- **NEXT** = high-value source to recover next if it produces buyer-visible inventory
- **TEST** = worth controlled validation, but not daily yet
- **API / COMMERCIAL** = pursue official access, not scraping as a core strategy
- **HOLD** = scrapeable, but lower ROI or higher noise than current priorities
- **JS / HEADLESS** = possible with Playwright, but operationally heavier
- **BLOCKED / HOSTILE** = anti-bot, Cloudflare, Akamai, or similar friction
- **DROP** = dead, not a marketplace, too small, or not worth operational effort

---

## Portfolio Decision Matrix

| Lane | Site | Domain | Why It Matters | Decision |
|---|---|---|---|---|
| Core | Sailboat Listings | `sailboatlistings.com` | Largest working sailing source, broad inventory, proven import path | **ACTIVE** |
| Core | TheYachtMarket | `theyachtmarket.com` | Strong sailing inventory, good buyer relevance | **ACTIVE** |
| Core | Dream Yacht Sales | `dreamyachtsales.com` | High-fit cat inventory, now clearing quality gates with real images and locations | **ACTIVE** |
| Core | CatamaranSite | `catamaransite.com` | Curated cat inventory, now partially recovered into visible buyer-facing stock | **ACTIVE** |
| Core | Moorings Brokerage | `mooringsbrokerage.com` | Charter exit cats, clean niche inventory | **ACTIVE** |
| Recovery | Catamarans.com | `catamarans.com` | Thematic fit is high, but current extraction still leaves weak residual rows that should stay suppressed from public browse | **HOLD** |
| Recovery | Denison Yachting | `denisonyachtsales.com` | Large SSR volume, but current scraper still produces buyer-invisible shells | **HOLD** |
| Controlled Test | Rightboat | `rightboat.com` | Good sail inventory, but rate-limits aggressively | **TEST** |
| Commercial | Boats.com | `boats.com` | Massive inventory, but should be official API/commercial | **API / COMMERCIAL** |
| Commercial | Boat Trader | `boattrader.com` | Boats Group property, same lane as boats.com | **API / COMMERCIAL** |
| Commercial | YachtWorld | `yachtworld.com` | Boats Group property, same lane as boats.com | **API / COMMERCIAL** |

---

## Active Daily Sources

These are the live portfolio sources and should remain the operational focus until data quality is stronger.

| Site | Domain | Verified Listings | Import Notes |
|---|---|---:|---|
| Sailboat Listings | `sailboatlistings.com` | 16,864 | Strong volume, but requires source-specific normalization |
| TheYachtMarket | `theyachtmarket.com` | 5,700 sail | Good buyer fit, image refreshes matter |
| Dream Yacht Sales | `dreamyachtsales.com` | 115 | Recovered into buyer-visible inventory after image/location fixes |
| CatamaranSite | `catamaransite.com` | 48 | Smaller source, but now producing real visible listings |
| Moorings Brokerage | `mooringsbrokerage.com` | 73 | Small but very high relevance |

**Operational instruction:** keep these stable, keep their cleanup rules improving, and do not dilute attention with too many new sources at once.

---

## Recovery / Promote Next

These are the next sources to recover only if they prove buyer-visible value.

### 1. Catamarans.com
- Domain: `catamarans.com`
- Verified listings: `2,013`
- Current status: **HOLD**
- Why it matters:
  - strong catamaran thematic fit
  - detail pages have solid price, image, and spec coverage
- Why it is still held:
  - location extraction remains weak on most rows
  - source/model consistency still has buyer-trust issues in the residual visible set
  - public browse should suppress held-source residual rows until the source is recovered intentionally

### 2. Denison Yachting
- Domain: `denisonyachtsales.com`
- Verified listings: `16,793`
- Current status: **HOLD**
- Why recover later:
  - large SSR source
  - substantial inventory upside
- Watchouts:
  - current scraper still lands as buyer-invisible inventory because media/location are not good enough yet

---

## Controlled Test Lane

### Rightboat
- Domain: `rightboat.com`
- Verified listings: `6,376 sail`
- Current status: **TEST**
- Why test:
  - strong sail inventory
  - good potential ROI
- Why not daily yet:
  - rate-limits aggressively
  - needs request throttling, caching, and conservative recrawl policy

**Rule:** do not promote Rightboat to daily until a low-rate validation pass proves stable extraction and acceptable ban risk.

---

## API / Commercial Lane

### Boats Group properties

Use the official/commercial lane for:
- `boats.com`
- `boattrader.com`
- `yachtworld.com`
- `boatshop24.com`
- `boatsandoutboards.co.uk`
- `inautia.com`
- `botentekoop.nl`
- `cosasdebarcos.com`
- `annoncesbateau.com`

Why:
- identical anti-bot challenge patterns
- legal/commercial risk is materially higher
- the repo already contains an API-oriented path in:
  - [C:\Users\Gil\OnlyHulls\scraper\fetch_boatsgroup_api.py](C:\Users\Gil\OnlyHulls\scraper\fetch_boatsgroup_api.py)

**Rule:** do not treat Boats Group as a scraper roadmap item. Treat it as a sales/business-development item.

---

## Good HOLD Candidates

These are valid future sources, but not ahead of the current portfolio priorities.

| Site | Domain | Verified Listings | Notes |
|---|---|---:|---|
| Multihull World | `multihullworld.com` | 61 | Good fit, but smaller source |
| CatamaranSite | `catamaransite.com` | 48 | Friendly source, curated inventory |
| Asia Yacht Brokers | `asiayachtbrokers.com` | 52 | Regional expansion candidate |
| Virgin Islands Yacht Broker | `virginislandsyachtbroker.com` | 23 | Caribbean relevance |
| Boote & Yachten | `boote-yachten.de` | 17 | EU expansion candidate |
| Camper & Nicholsons | `camperandnicholsons.com` | ~12 | Prestigious but smaller |
| Multihulls-4Sale | `multihulls-4sale.com` | ~13 | Useful niche feed |
| YATCO | `yatco.com` | 24 | More superyacht-oriented, lower current fit |

---

## JS / Headless Candidates

These may be technically workable, but they are operationally heavier and should not outrank strong SSR sources.

| Site | Domain | Claimed Listings | Notes |
|---|---|---:|---|
| CatamaranWorld | `catamaranworld.com` | 1,000+ | Wix, JS-heavy |
| Just Catamarans | `justcatamarans.net` | 100+ | JS app |
| Yachtr | `yachtr.com` | 10,700+ | dynamic loading |
| Fraser Yachts | `fraseryachts.com` | 164 | SPA behavior |
| Trade A Boat AU | `tradeaboat.com.au` | ~12 | embedded data may be extractable |

**Rule:** only pursue these after the SSR portfolio is stable and profitable.

---

## Blocked / Hostile Sources

These should not be part of the near-term scraping roadmap.

| Site | Domain | Reason |
|---|---|---|
| Boat24 | `boat24.com` | Cloudflare / geo friction |
| Boot24 | `boot24.com` | Cloudflare challenge |
| YachtAll | `yachtall.com` | Cloudflare challenge |
| Scanboat | `scanboat.com` | unreliable sail paths + blocking |
| BOAT International | `boatinternational.com` | AWS WAF / captcha |
| Subito | `subito.it` | Akamai |
| Marktplaats | `marktplaats.nl` | CloudFront + ThreatMetrix |

---

## Apollo Duck Clarification

Apollo Duck was previously contradictory in this document. The operational truth is:

- `apolloduck.com` main engine is **not** a good core source for OnlyHulls
- the historic issue is poor usable import quality, especially around price extraction and inconsistent subdomains
- `apolloduck.us` may expose some prices in SSR, but it is not strong enough to displace higher-priority sources

**Decision:** keep Apollo Duck out of the main roadmap for now. It is not a `NEXT` source.

---

## Drop Lane

These should not receive more engineering time.

### Dead or broken
- `boatbuys.com`
- `sailboat.guide`
- `usedboattests.com`
- `boatsforsale.com`
- `cfrgroup-brokerage.com`
- `sunreef-catamarans.com/brokerage`
- `bavariayachts.com/en/used-boats/`
- `fountaine-pajot.com/en/occasion/`

### Not actual marketplaces
- `iboats.com`
- `yachtbroker.org`
- `sunsail.com/yachts-for-sale`
- `tide.no`
- `beneteau.com/us/pre-owned`
- `leopardcatamarans.com`
- `goodoldboat.com`

### Low-value general classifieds
- `craigslist.org`
- `facebook.com/marketplace`
- `kijiji.ca`
- most forum-style or login-gated classified sections

---

## Live Scraper Inventory

Current scraper files in the repo:

- `scrape_sailboats.py`
- `scrape_yachtmarket.py`
- `scrape_catamarans_com.py`
- `scrape_moorings.py`
- `scrape_denison.py`
- `scrape_dreamyacht.py`
- `scrape_multihullworld.py`
- `scrape_catamaransite.py`
- `scrape_multihullcompany.py`
- `scrape_camperandnicholsons.py`
- `scrape_vi_yachtbroker.py`
- `scrape_boote_yachten.py`
- `scrape_apolloduck.py`
- `scrape_apolloduck_us.py`
- `scrape_multihulls4sale.py`
- `fetch_boatsgroup_api.py`

Not all scraper files belong in the daily pipeline. Presence of a file means “explored or available,” not “approved for production.”

---

## Recommended Execution Order

1. Keep the active buyer-visible sources healthy and improve their normalization rules.
2. Recover `catamarans.com` only if location extraction becomes materially better.
3. Recover `denisonyachtsales.com` only if sailboat-only scraping produces visible inventory with images.
4. Run a low-rate Rightboat validation pass with strict throttling.
5. Keep Boats Group in business-development / API conversations.
6. Revisit HOLD sources only after source-quality KPIs improve.

---

## Success Criteria for Promoting a Source

A source should not move to **ACTIVE** unless it meets all of these:

- price extraction is reliable
- location extraction is reliable
- image count/media quality is acceptable
- duplicate rate is manageable
- scrape stability is acceptable under conservative rate limits
- buyer-facing listing quality is good enough to avoid polluting browse and matches

If a source adds volume but lowers trust, it should stay out of the daily pipeline.
