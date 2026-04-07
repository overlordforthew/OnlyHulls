import { query, queryOne } from "@/lib/db";
import {
  buildBoatSearchUrl,
  buildSavedSearchName,
  buildSavedSearchSignature,
  buildWhereClause,
  normalizeBoatSearchFilters,
  type BoatSearchFilters,
} from "@/lib/search/boat-search";

interface SavedSearchRow {
  id: string;
  name: string;
  search_query: string | null;
  tag: string | null;
  min_price: string | null;
  max_price: string | null;
  min_year: number | null;
  max_year: number | null;
  rig_type: string | null;
  hull_type: string | null;
  sort: string;
  dir: string;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

interface SavedSearchEmailRow extends SavedSearchRow {
  user_id: string;
  email: string;
  display_name: string | null;
  email_alerts: "instant" | "weekly";
}

interface SavedSearchBoatRow {
  id: string;
  slug: string | null;
  year: number;
  make: string;
  model: string;
  asking_price: number;
  currency: string;
  location_text: string | null;
  hero_url: string | null;
}

export interface SavedSearchSummary {
  savedSearchCount: number;
  searchesWithUpdates: number;
  totalNewResults: number;
}

export interface SavedSearchRecord {
  id: string;
  name: string;
  filters: BoatSearchFilters;
  browseUrl: string;
  newResults: number;
  totalResults: number;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string;
}

export interface SavedSearchAlertBoat {
  id: string;
  slug: string | null;
  title: string;
  price: number;
  currency: string;
  locationText: string | null;
  heroUrl: string | null;
}

export interface SavedSearchAlertCandidate {
  savedSearchId: string;
  userId: string;
  email: string;
  displayName: string | null;
  emailAlerts: "instant" | "weekly";
  name: string;
  browseUrl: string;
  newResults: number;
  lastCheckedAt: string;
  boats: SavedSearchAlertBoat[];
}

function rowToFilters(row: SavedSearchRow): BoatSearchFilters {
  return normalizeBoatSearchFilters({
    search: row.search_query ?? "",
    minPrice: row.min_price,
    maxPrice: row.max_price,
    minYear: row.min_year?.toString() ?? null,
    maxYear: row.max_year?.toString() ?? null,
    rigType: row.rig_type,
    hullType: row.hull_type,
    tag: row.tag,
    sort: row.sort as BoatSearchFilters["sort"],
    dir: row.dir as BoatSearchFilters["dir"],
  });
}

async function countResults(filters: BoatSearchFilters, since?: string) {
  const { where, params } = buildWhereClause(filters);
  const conditions = [where];
  const queryParams = [...params];

  if (since) {
    queryParams.push(since);
    conditions.push(`b.created_at > $${queryParams.length}`);
  }

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM boats b
     LEFT JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${conditions.join(" AND ")}`,
    queryParams
  );

  return parseInt(result?.count || "0", 10);
}

async function listMatchingBoats(
  filters: BoatSearchFilters,
  since: string | undefined,
  limit: number
): Promise<SavedSearchAlertBoat[]> {
  const { where, params } = buildWhereClause(filters);
  const conditions = [where];
  const queryParams = [...params];

  if (since) {
    queryParams.push(since);
    conditions.push(`b.created_at > $${queryParams.length}`);
  }

  queryParams.push(limit);

  const rows = await query<SavedSearchBoatRow>(
    `SELECT b.id, b.slug, b.year, b.make, b.model, b.asking_price, b.currency, b.location_text,
            (SELECT url
             FROM boat_media bm
             WHERE bm.boat_id = b.id AND bm.type = 'image'
             ORDER BY sort_order
             LIMIT 1) as hero_url
     FROM boats b
     LEFT JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT $${queryParams.length}`,
    queryParams
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: `${row.year} ${row.make} ${row.model}`,
    price: Number(row.asking_price),
    currency: row.currency,
    locationText: row.location_text,
    heroUrl: row.hero_url,
  }));
}

async function hydrateSavedSearch(row: SavedSearchRow): Promise<SavedSearchRecord> {
  const filters = rowToFilters(row);
  const [totalResults, newResults] = await Promise.all([
    countResults(filters),
    countResults(filters, row.last_checked_at),
  ]);

  return {
    id: row.id,
    name: row.name,
    filters,
    browseUrl: buildBoatSearchUrl(filters),
    newResults,
    totalResults,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastCheckedAt: row.last_checked_at,
  };
}

export async function listSavedSearches(userId: string): Promise<SavedSearchRecord[]> {
  const rows = await query<SavedSearchRow>(
    `SELECT id, name, search_query, tag, min_price, max_price, min_year, max_year,
            rig_type, hull_type, sort, dir, last_checked_at, created_at, updated_at
     FROM saved_searches
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return Promise.all(rows.map(hydrateSavedSearch));
}

export async function getSavedSearchSummary(userId: string): Promise<SavedSearchSummary> {
  const searches = await listSavedSearches(userId);

  return {
    savedSearchCount: searches.length,
    searchesWithUpdates: searches.filter((search) => search.newResults > 0).length,
    totalNewResults: searches.reduce((sum, search) => sum + search.newResults, 0),
  };
}

export async function listSavedSearchAlertCandidates(limitPerSearch = 5) {
  const rows = await query<SavedSearchEmailRow>(
    `SELECT ss.id, ss.user_id, ss.name, ss.search_query, ss.tag, ss.min_price, ss.max_price,
            ss.min_year, ss.max_year, ss.rig_type, ss.hull_type, ss.sort, ss.dir,
            ss.last_checked_at, ss.created_at, ss.updated_at,
            u.email, u.display_name, u.email_alerts
     FROM saved_searches ss
     JOIN users u ON u.id = ss.user_id
     WHERE u.email_verified = true
       AND u.email_alerts IN ('instant', 'weekly')
       AND (
         u.email_alerts = 'instant'
         OR ss.last_checked_at <= NOW() - INTERVAL '7 days'
       )
     ORDER BY ss.last_checked_at ASC, ss.created_at ASC`
  );

  const alerts: SavedSearchAlertCandidate[] = [];

  for (const row of rows) {
    const filters = rowToFilters(row);
    const newResults = await countResults(filters, row.last_checked_at);
    if (newResults < 1) {
      continue;
    }

    const boats = await listMatchingBoats(filters, row.last_checked_at, limitPerSearch);

    alerts.push({
      savedSearchId: row.id,
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      emailAlerts: row.email_alerts,
      name: row.name,
      browseUrl: buildBoatSearchUrl(filters),
      newResults,
      lastCheckedAt: row.last_checked_at,
      boats,
    });
  }

  return alerts;
}

export async function createSavedSearch(userId: string, input: Partial<BoatSearchFilters>) {
  const filters = normalizeBoatSearchFilters(input);
  const signature = buildSavedSearchSignature(filters);
  const existing = await queryOne<SavedSearchRow>(
    `SELECT id, name, search_query, tag, min_price, max_price, min_year, max_year,
            rig_type, hull_type, sort, dir, last_checked_at, created_at, updated_at
     FROM saved_searches
     WHERE user_id = $1 AND signature = $2`,
    [userId, signature]
  );

  if (existing) {
    const updated = await queryOne<SavedSearchRow>(
      `UPDATE saved_searches
       SET name = $3,
           sort = $4,
           dir = $5,
           updated_at = NOW()
       WHERE user_id = $1 AND signature = $2
       RETURNING id, name, search_query, tag, min_price, max_price, min_year, max_year,
                 rig_type, hull_type, sort, dir, last_checked_at, created_at, updated_at`,
      [userId, signature, buildSavedSearchName(filters), filters.sort, filters.dir]
    );

    return {
      duplicate: true,
      savedSearch: await hydrateSavedSearch(updated ?? existing),
    };
  }

  const created = await queryOne<SavedSearchRow>(
    `INSERT INTO saved_searches (
       user_id, name, signature, search_query, tag, min_price, max_price,
       min_year, max_year, rig_type, hull_type, sort, dir
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13
     )
     RETURNING id, name, search_query, tag, min_price, max_price, min_year, max_year,
               rig_type, hull_type, sort, dir, last_checked_at, created_at, updated_at`,
    [
      userId,
      buildSavedSearchName(filters),
      signature,
      filters.search || null,
      filters.tag,
      filters.minPrice ? Number(filters.minPrice) : null,
      filters.maxPrice ? Number(filters.maxPrice) : null,
      filters.minYear ? Number(filters.minYear) : null,
      filters.maxYear ? Number(filters.maxYear) : null,
      filters.rigType,
      filters.hullType,
      filters.sort,
      filters.dir,
    ]
  );

  return {
    duplicate: false,
    savedSearch: await hydrateSavedSearch(created as SavedSearchRow),
  };
}

export async function acknowledgeSavedSearch(userId: string, savedSearchId: string) {
  const updated = await queryOne<SavedSearchRow>(
    `UPDATE saved_searches
     SET last_checked_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, name, search_query, tag, min_price, max_price, min_year, max_year,
               rig_type, hull_type, sort, dir, last_checked_at, created_at, updated_at`,
    [savedSearchId, userId]
  );

  return updated ? hydrateSavedSearch(updated) : null;
}

export async function deleteSavedSearch(userId: string, savedSearchId: string) {
  const deleted = await queryOne<{ id: string }>(
    `DELETE FROM saved_searches
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [savedSearchId, userId]
  );

  return deleted?.id ?? null;
}

export async function markSavedSearchAlertSent(savedSearchId: string, lastCheckedAt: string) {
  const updated = await queryOne<{ id: string }>(
    `UPDATE saved_searches
     SET last_checked_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND last_checked_at = $2
     RETURNING id`,
    [savedSearchId, lastCheckedAt]
  );

  return Boolean(updated);
}
