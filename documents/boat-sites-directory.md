# Boat Listing Sites — Verified Master Directory

Last verified: 2026-03-30 from Hetzner CX33 server.

## Scrapability Legend
- **ACTIVE** = Currently scraping in daily pipeline
- **READY** = SSR, no anti-bot, confirmed scrapable from Hetzner
- **WORKABLE** = SSR but needs lazy-load handling or light protection
- **JS-ONLY** = Needs headless browser (Playwright/Puppeteer)
- **GH-ACTIONS** = Blocked from Hetzner, works from GitHub Actions (Azure IPs)
- **BLOCKED** = Cloudflare JS challenge or WAF, needs real browser
- **DOWN** = Site unreachable or broken SSL
- **NOT-LISTING** = Not actually a boat marketplace

---

## TIER 1 — Easy Scrape Targets (SSR, no anti-bot)

| # | Site | Domain | Verified Listings | Sail Focus | Status | Images | Notes |
|---|------|--------|------------------|------------|--------|--------|-------|
| 1 | Sailboat Listings | sailboatlistings.com | **16,864 active / 111,590 total** | Sailboats only | **ACTIVE** | Yes (inline) | Best source. Pure FSBO sail. Zero protection. |
| 2 | Apollo Duck | apolloduck.com | **14,000+ (361 pages)** | Strong sail (71% cruisers) | **ACTIVE** | Yes (CDN) but hotlink-protected | SSR, no anti-bot. Images return 400 from external referers. |
| 3 | TheYachtMarket | theyachtmarket.com | **5,700 sail (572 pages)** | Strong sail, bluewater subcats | **ACTIVE** | Lazy-load (data-src) | SSR. Need to extract data-src for images. |
| 4 | Multihull World | multihullworld.com | **61 (24 shown)** | Cats/tris only | **READY** | Yes (inline) | Small but clean. SSR, zero protection. |
| 5 | Catamarans.com | catamarans.com | **2,013 total (20/page)** | Catamarans only | **READY** | Yes (webp) | Clean SSR, paginated. Leading cat brokerage since 1989. |
| 6 | CatamaranSite.com | catamaransite.com | **48** | Cruising cats only | **READY** | Yes (lazy) | Has JSON-LD structured data. Very scrape-friendly. |
| 7 | Catamaran Guru | catamaranguru.com | **27** | Catamarans | **READY** | Yes (iyba.pro CDN) | SSR, paginated. FL/TX/Caribbean. |
| 8 | Multihull Central | multihullcentral.com | **~16 featured** | Multihulls | **READY** | Yes | SSR, South Pacific leader. |
| 9 | Boatsfsbo.com | boatsfsbo.com | **~10** | All types, FSBO | **READY** | Yes | SSR, small inventory. |
| 10 | Boatnet.de | boatnet.de | **~9 featured** | All types | **READY** | Yes | German SSR site. |
| 11 | BoatNation | boatnation.com | **~12** | All types | **READY** | Yes (lazy) | SSR, small marketplace. |

## TIER 2 — Workable (SSR with caveats)

| # | Site | Domain | Verified Listings | Sail Focus | Status | Images | Notes |
|---|------|--------|------------------|------------|--------|--------|-------|
| 12 | Boatcrazy | boatcrazy.com | **153 sailboats** | All types, cruiser-heavy | **WORKABLE** | Need JS | SSR content, reCAPTCHA on forms only. |
| 13 | Rightboat | rightboat.com | **6,376 sail results** | All types | **WORKABLE** | Lazy | SSR with browser UA, but rate-limits aggressively. |
| 14 | BoatsForSale.co.uk | boatsforsale.co.uk | **822 boat links** | All types, UK | **WORKABLE** | Brand logos only | SSR PHP, light Cloudflare (passable with UA). |
| 15 | Moorings Brokerage | mooringsbrokerage.com | **73 total (30 shown)** | Charter fleet cats/monos | **WORKABLE** | Yes (cloudinary) | SSR, JSON-LD schema. Clean paginated data. |
| 16 | Dream Yacht Sales | dreamyachtsales.com | **115 total (9/page)** | Used charter cats | **WORKABLE** | Yes | SSR via FacetWP. Bali, FP, Lagoon cats. |
| 17 | Denison Yachting | denisonyachtsales.com | **16,793 total (24 shown)** | All types | **WORKABLE** | Yes (YW CDN) | Massive SSR. Pulls from YachtWorld feed. |
| 18 | Multihulls-4Sale | multihulls-4sale.com | **~13** | Cats/tris | **WORKABLE** | Yes | SSR, reCAPTCHA on forms not blocking page. |
| 19 | Camper & Nicholsons | camperandnicholsons.com | **~12 featured** | Superyachts | **WORKABLE** | Yes (webp) | SSR, reCAPTCHA present but not blocking. |
| 20 | YachtX | yachtx.com | **~20 featured** | All types, FSBO | **WORKABLE** | Yes | SSR Drupal. Clean. |
| 21 | Multihull Company | multihullcompany.com | **~14 exclusive** | Multihulls | **WORKABLE** | JS carousel | SSR, CleanTalk bot detector. |
| 22 | Boatsales.com.au | boatsales.com.au | **~5 featured** | All types, AU | **WORKABLE** | Yes (CDN) | SSR+React, DDoS protection (not aggressive). |
| 23 | BoatsOnline.com.au | boatsonline.com.au | **5 in carousel** | All types, AU | **WORKABLE** | Yes (yachthub CDN) | SSR, no protection. Small sample. |
| 24 | Hisse et Oh | hisse-et-oh.com | **~40** | Sail (French) | **WORKABLE** | Yes (thumbs) | French sailing community. SSR + JS hybrid. |
| 25 | yacht.de | yacht.de | **~15** | Sail (German) | **WORKABLE** | Yes (Cloudinary) | German SSR magazine + marketplace. |
| 26 | bateaux.com | bateaux.com | **~5 shown** | All types (French) | **WORKABLE** | Yes | French SSR. Full listings behind link. |
| 27 | Leopard Brokerage | leopardbrokerage.com | **~3 featured** | Leopard cats | **WORKABLE** | Yes (Cloudinary) | Hybrid SSR + JS search. |

## TIER 3 — JS-Only (Need headless browser)

| # | Site | Domain | Claimed Listings | Status | Notes |
|---|------|--------|-----------------|--------|-------|
| 28 | BoatExportUSA | boatexportusa.com | 27,700 | **JS-ONLY** | Angular SPA. Zero content in HTML. |
| 29 | Yachtr (IYBA) | yachtr.com | 10,700+ | **JS-ONLY** | WordPress + AJAX. All content loaded dynamically. |
| 30 | CatamaransForSale.net | catamaransforsale.net | 79 active | **JS-ONLY** | Next.js client-side. |
| 31 | CatamaranWorld | catamaranworld.com | 1,000+ claimed | **JS-ONLY** | Wix platform. Zero content in source. |
| 32 | Just Catamarans | justcatamarans.net | 100+ | **JS-ONLY** | JS app, no content in source. |
| 33 | Northrop & Johnson | northropandjohnson.com | 661 | **JS-ONLY** | Algolia search, zero listings in source. |
| 34 | Fraser Yachts | fraseryachts.com | 164 | **JS-ONLY** | Vue.js SPA. |
| 35 | United Yacht Sales | unitedyacht.com | 1,000+ | **JS-ONLY** | /yachts-for-sale returns 404. JS-rendered. |
| 36 | MarineSource | marinesource.com | 7,000+ claimed | **JS-ONLY** | Next.js, no listings on homepage. |
| 37 | MoreBoats | moreboats.com | 7,600 claimed | **JS-ONLY** | Just a JS redirect page. |

## TIER 4 — Cloudflare Blocked (from Hetzner IP)

All Boats Group properties + affiliated sites. Would need GH Actions (Azure IPs) or residential proxy.

| # | Site | Domain | Est. Listings | Owner | Protection |
|---|------|--------|--------------|-------|------------|
| 38 | Boats.com | boats.com | 120,000+ | Boats Group | CF JS challenge |
| 39 | Boat Trader | boattrader.com | 108,000+ | Boats Group | CF JS challenge |
| 40 | YachtWorld | yachtworld.com | 70,000-80,000 | Boats Group | CF JS challenge |
| 41 | Boat24 | boat24.com | 34,000+ | Independent | CF (IP/geo block) |
| 42 | YachtAll | yachtall.com | 18,000+ | Independent | CF JS challenge |
| 43 | Boot24 | boot24.com | 17,000+ | Independent | CF JS challenge |
| 44 | Boatdealers.ca | boatdealers.ca | 10,000 | Independent | CF JS challenge |
| 45 | Boatshop24 | boatshop24.com | 6,000+ | Boats Group | CF JS challenge |
| 46 | BoatsAndOutboards | boatsandoutboards.co.uk | 6,000 | Boats Group | CF JS challenge |
| 47 | Inautia | inautia.com | 5,000+ | Boats Group | CF JS challenge |
| 48 | Scanboat | scanboat.com | 5,000+ | Independent | Sail URL 404 |
| 49 | Botenbank | botenbank.nl | 4,000+ | Independent | CF JS challenge |
| 50 | Botentekoop | botentekoop.nl | 2,000+ | Boats Group | CF JS challenge |
| 51 | Cosas de Barcos | cosasdebarcos.com | 2,000+ | Boats Group | CF JS challenge |
| 52 | Annonces du Bateau | annoncesbateau.com | 2,000+ | Boats Group | CF JS challenge |
| 53 | Band of Boats | bandofboats.com | 1,500+ | Beneteau Group | CF blocked |
| 54 | The Hull Truth | thehulltruth.com | 700/mo | Independent | CF hard block |
| 55 | Boatmart | boatmart.com | 800+ | Independent | Blocked (403) |
| 56 | SailboatData | sailboatdata.com | 200+ | Independent | Blocked (403) |
| 57 | Yachtfocus | yachtfocus.com | 1,000+ | Independent | Blocked (403) |
| 58 | Nauticexpo | nauticexpo.com | Unknown | B2B | Blocked (403) |
| 59 | BOAT International | boatinternational.com | 600+ | Independent | AWS WAF captcha |
| 60 | Sailing Anarchy | sailinganarchy.com | 150+ | Independent | Tollbit paywall (402) |

## TIER 5 — Down / Broken / Not Listing Sites

| # | Site | Domain | Status | Notes |
|---|------|--------|--------|-------|
| 61 | BoatBuys | boatbuys.com | **DOWN** | ECONNREFUSED |
| 62 | Sailboat.guide | sailboat.guide | **DOWN** | ECONNREFUSED |
| 63 | UsedBoatTests | usedboattests.com | **DOWN** | TLS hostname mismatch |
| 64 | Boatsforsale.com | boatsforsale.com | **DOWN** | SSL expired |
| 65 | iBoats | iboats.com | **NOT-LISTING** | Forum, not marketplace |
| 66 | YachtBroker.org | yachtbroker.org | **NOT-LISTING** | B2B membership ($349/mo) |
| 67 | Sunsail | sunsail.com/yachts-for-sale | **NOT-LISTING** | Landing page, no inventory |
| 68 | Burgess | burgessyachts.com | **BROKEN** | /en/sale/ returns 404 |
| 69 | IYC | iyc.com | **BROKEN** | /yachts-for-sale returns 404 |

## TIER 6 — Unchecked Regional / Niche

| # | Site | Domain | Est. Listings | Region | Notes |
|---|------|--------|--------------|--------|-------|
| 70 | TradeABoat.com.au | tradeaboat.com.au | 2,500 | Australia | Sail URL 404, needs correct path |
| 71 | Best Boats 24 | best-boats24.net | 2,000+ | Germany | Not tested |
| 72 | Boote & Yachten | boote-yachten.de | 1,500+ | Germany | Not tested |
| 73 | Apollo Duck Asia | apolloduck.asia | Unknown | Asia | Same engine as .com |
| 74 | Apollo Duck EU | apolloduck.eu | Unknown | Europe | Same engine as .com |
| 75 | Apollo Duck US | apolloduck.us | Unknown | US | Same engine as .com |
| 76 | Apollo Duck Japan | jp.apolloduck.com | Unknown | Japan | Same engine as .com |
| 77 | Apollo Duck Oceania | oceania.apolloduck.com | Unknown | AU/NZ | Same engine as .com |
| 78 | ReelBoating | reelboating.com | 1,000 | US | Not tested |
| 79 | Copart (boats) | copart.com/boats | 900 | US | Auction, login required |
| 80 | Facebook Marketplace | facebook.com/marketplace | 50,000+ | Global | Login required |
| 81 | Craigslist | craigslist.org | Thousands/city | US | Blocks IPs aggressively |
| 82 | eBay Motors (boats) | ebay.com/b/Boats | 600 | US | Partial (structured data) |
| 83 | Kijiji | kijiji.ca | Thousands/city | Canada | Dynamic, login walls |
| 84 | Gumtree | gumtree.com | Unknown | UK/AU | Not tested |
| 85 | Subito.it | subito.it | Unknown | Italy | Not tested |
| 86 | Marktplaats | marktplaats.nl | Unknown | Netherlands | Not tested |
| 87 | itboat.com | itboat.com | Unknown | Russia | Not tested |
| 88 | tide.no | tide.no | Unknown | Norway | Not tested |
| 89 | Windcraft Multihulls | windcraftmultihulls.com | 30+ | AU | Not tested |
| 90 | Multihull Centre | multihullcentre.com | 50+ | UK | Not tested |
| 91 | Asia Yacht Brokers | asiayachtbrokers.com | 100+ | SEA | Not tested |
| 92 | Asia Power Boats | asiapowerboats.com | Unknown | Japan/SGP | Not tested |
| 93 | The Yacht Sales Co | yachtsalesco.com | Unknown | AU/NZ | Not tested |
| 94 | Bluewater Yacht Sales | bluewateryachtsales.com | 100+ | US | Not tested |
| 95 | Edwards Yacht Sales | edwardsyachtsales.com | 100+ | US | Not tested |
| 96 | Virgin Islands YB | virginislandsyachtbroker.com | 50+ | Caribbean | Not tested |
| 97 | Horizon Yacht Sales | horizonyachtsales.com | 30+ | Caribbean | Not tested |
| 98 | GoodOldBoat | goodoldboat.com | Unknown | US | Classic sail magazine |
| 99 | SailingTexas | sailingtexas.com | Unknown | US (TX) | Regional |
| 100 | Sailboat Owners | sailboatowners.com | 100+ | US | Community classifieds |

## Builder / Brand Brokerage (not tested)

| # | Site | Domain | Brand |
|---|------|--------|-------|
| 101 | Lagoon Brokerage | cfrgroup-brokerage.com | Lagoon |
| 102 | Beneteau Pre-owned | beneteau.com/us/pre-owned | Beneteau |
| 103 | Jeanneau Pre-owned | jeanneau.com/pre-owned | Jeanneau |
| 104 | Fountaine Pajot | fountaine-pajot.com | FP |
| 105 | Sunreef Catamarans | sunreef-catamarans.com | Sunreef |
| 106 | Bavaria Yachts | bavariayachts.com | Bavaria |

---

## PRIORITY SCRAPE TARGETS (by ROI)

Based on verified data — where we get the most boats for the least effort:

| Priority | Site | Verified Listings | Effort | Value |
|----------|------|------------------|--------|-------|
| **P0** | sailboatlistings.com | 16,864 active | Zero (already running) | Highest — pure sail FSBO |
| **P0** | apolloduck.com | 14,000+ | Low (running, no images) | High — 71% cruisers |
| **P0** | theyachtmarket.com | 5,700 sail | Low (running, needs price fix) | High — bluewater subcats |
| **P1** | catamarans.com | 2,013 | Low (SSR, clean) | High — pure cat brokerage |
| **P1** | denisonyachtsales.com | 16,793 | Low (SSR) | Huge volume but pulls from YW |
| **P1** | rightboat.com | 6,376 sail | Medium (rate limits) | Large — needs throttling |
| **P2** | boatcrazy.com | 153 sail | Low (SSR) | Decent — private sellers |
| **P2** | mooringsbrokerage.com | 73 | Low (SSR + JSON-LD) | Charter exit fleet cats |
| **P2** | dreamyachtsales.com | 115 | Low (SSR) | Charter exit fleet |
| **P2** | multihullworld.com | 61 | Low (SSR) | Clean cat/tri data |
| **P3** | boats.com | 120,000+ | High (GH Actions + CF bypass) | Massive but hard |
| **P3** | boat24.com | 34,000+ | High (CF blocked) | Huge EU inventory |
| **P3** | yachtall.com | 18,000+ | High (CF blocked) | Large but blocked |

## Boats Group Monopoly (all Cloudflare-blocked from Hetzner)

These 9 sites are owned by Boats Group and share identical Cloudflare JS challenge protection:
boats.com, boattrader.com, yachtworld.com, boatshop24.com, boatsandoutboards.co.uk, inautia.com, botentekoop.nl, cosasdebarcos.com, annoncesbateau.com

**Combined: ~300,000+ listings, all behind the same CF wall.**
Can potentially be scraped via GitHub Actions (Azure IPs bypass CF) — already proven with boats.com scraper.
