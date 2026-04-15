import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import {
  convertCurrencyToUsd,
  normalizeSupportedCurrency,
  type SupportedCurrency,
  USD_TO_CURRENCY_RATE,
} from "@/lib/currency";

export type BoatSortField = "price" | "size" | "year" | "newest";
export type BoatSortDir = "asc" | "desc";

export interface BoatSearchFilters {
  search: string;
  location: string | null;
  page: number;
  limit: number;
  minPrice: string | null;
  maxPrice: string | null;
  minYear: string | null;
  maxYear: string | null;
  rigType: string | null;
  hullType: string | null;
  tag: string | null;
  currency: SupportedCurrency;
  sort: BoatSortField;
  dir: BoatSortDir;
}

const VALID_SORTS = new Set<BoatSortField>(["price", "size", "year", "newest"]);
const VALID_DIRS = new Set<BoatSortDir>(["asc", "desc"]);
const PRICE_USD_SQL = `CASE
  WHEN b.asking_price_usd IS NOT NULL THEN b.asking_price_usd
  WHEN b.currency = 'EUR' THEN b.asking_price / ${USD_TO_CURRENCY_RATE.EUR}
  WHEN b.currency = 'GBP' THEN b.asking_price / ${USD_TO_CURRENCY_RATE.GBP}
  ELSE b.asking_price
END`;
const LOA_SQL =
  "CAST(NULLIF(REGEXP_REPLACE(d.specs->>'loa', '[^0-9.]', '', 'g'), '') AS float)";
const NORMALIZED_MODEL_LOA_SQL = `CAST(
  NULLIF(
    SUBSTRING(
      REGEXP_REPLACE(LOWER(COALESCE(b.model, '')), '^(\\d)\\s+(\\d)(?=$|\\s)', '\\1.\\2')
      FROM '([0-9]+(?:\\.[0-9]+)?)'
    ),
    ''
  ) AS float
)`;
const SANITIZED_LOA_SQL = `CASE
  WHEN LOWER(COALESCE(b.make, '')) = 'bali'
    AND ${LOA_SQL} IS NOT NULL
    AND ${NORMALIZED_MODEL_LOA_SQL} IS NOT NULL
    AND ${LOA_SQL} > (${NORMALIZED_MODEL_LOA_SQL} * 1.6)
    AND ABS((${LOA_SQL} / 3.28084) - ${NORMALIZED_MODEL_LOA_SQL}) <= 2.5
    THEN ROUND(((${LOA_SQL} / 3.28084)::numeric), 1)::float
  ELSE ${LOA_SQL}
END`;
const QUALITY_SCORE_SQL = "COALESCE((d.documentation_status->>'import_quality_score')::int, 100)";
const IMAGE_COUNT_SQL =
  "(SELECT count(*) FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image')";
const LOCATION_READY_SQL =
  "CASE WHEN COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> '' THEN 1 ELSE 0 END";

interface BoatSearchFilterInput extends Omit<Partial<BoatSearchFilters>, "currency"> {
  currency?: string;
}

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumberString(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return Number.isFinite(Number(trimmed)) ? trimmed : null;
}

function normalizeIntegerString(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^-?\d+$/.test(trimmed) ? trimmed : null;
}

function clampPositiveInt(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

export function normalizeBoatSearchFilters(input: BoatSearchFilterInput): BoatSearchFilters {
  const sort = VALID_SORTS.has(input.sort as BoatSortField)
    ? (input.sort as BoatSortField)
    : "newest";
  const dir = VALID_DIRS.has(input.dir as BoatSortDir)
    ? (input.dir as BoatSortDir)
    : sort === "newest"
      ? "desc"
      : "asc";

  return {
    search: normalizeText(input.search) ?? "",
    location: normalizeText(input.location),
    page: clampPositiveInt(Number(input.page ?? 1), 1, 10_000),
    limit: clampPositiveInt(Number(input.limit ?? 30), 30, 100),
    minPrice: normalizeNumberString(input.minPrice),
    maxPrice: normalizeNumberString(input.maxPrice),
    minYear: normalizeIntegerString(input.minYear),
    maxYear: normalizeIntegerString(input.maxYear),
    rigType: normalizeText(input.rigType),
    hullType: normalizeText(input.hullType),
    tag: normalizeText(input.tag),
    currency: normalizeSupportedCurrency(input.currency),
    sort,
    dir,
  };
}

export function filtersFromSearchParams(searchParams: URLSearchParams): BoatSearchFilters {
  return normalizeBoatSearchFilters({
    search: searchParams.get("q") || "",
    location: searchParams.get("location"),
    page: parseInt(searchParams.get("page") || "1", 10),
    limit: parseInt(searchParams.get("limit") || "30", 10),
    minPrice: searchParams.get("minPrice"),
    maxPrice: searchParams.get("maxPrice"),
    minYear: searchParams.get("minYear"),
    maxYear: searchParams.get("maxYear"),
    rigType: searchParams.get("rigType"),
    hullType: searchParams.get("hullType"),
    tag: searchParams.get("tag"),
    currency: searchParams.get("currency") || undefined,
    sort: (searchParams.get("sort") as BoatSortField | null) || "newest",
    dir: (searchParams.get("dir") as BoatSortDir | null) || "desc",
  });
}

export function buildBoatSearchParams(filters: Partial<BoatSearchFilters>) {
  const normalized = normalizeBoatSearchFilters(filters);
  const params = new URLSearchParams();

  if (normalized.search) params.set("q", normalized.search);
  if (normalized.location) params.set("location", normalized.location);
  if (normalized.tag) params.set("tag", normalized.tag);
  if (normalized.minPrice) params.set("minPrice", normalized.minPrice);
  if (normalized.maxPrice) params.set("maxPrice", normalized.maxPrice);
  if (normalized.minYear) params.set("minYear", normalized.minYear);
  if (normalized.maxYear) params.set("maxYear", normalized.maxYear);
  if (normalized.rigType) params.set("rigType", normalized.rigType);
  if (normalized.hullType) params.set("hullType", normalized.hullType);
  if (normalized.currency !== "USD") params.set("currency", normalized.currency);
  params.set("sort", normalized.sort);
  params.set("dir", normalized.dir);

  return params;
}

export function buildBoatSearchUrl(filters: Partial<BoatSearchFilters>) {
  const params = buildBoatSearchParams(filters);
  const query = params.toString();
  return query ? `/boats?${query}` : "/boats";
}

export function buildOrderBy(sort: string, dir: string) {
  const SORT_MAP: Record<string, string> = {
    price: PRICE_USD_SQL,
    size: SANITIZED_LOA_SQL,
    year: "b.year",
    newest: "b.created_at",
  };
  const sortCol = SORT_MAP[sort] || SORT_MAP.newest;
  const sortDir = dir === "desc" ? "DESC" : "ASC";

  const listingBoost =
    sort === "newest"
      ? `CASE
           WHEN b.source_url IS NULL AND COALESCE(u.subscription_tier::text, '') IN ('featured', 'broker') THEN 2
           WHEN b.source_url IS NULL THEN 1
           ELSE 0
         END DESC, `
      : "";

  const trustTiebreakers =
    sort === "newest"
      ? `${LOCATION_READY_SQL} DESC, ${IMAGE_COUNT_SQL} DESC, ${QUALITY_SCORE_SQL} DESC, `
      : "";

  return `${listingBoost}(EXISTS (SELECT 1 FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image')) DESC, ${trustTiebreakers}${sortCol} ${sortDir} NULLS LAST, ${QUALITY_SCORE_SQL} DESC, b.updated_at DESC, b.id DESC`;
}

export function buildWhereClause(filters: BoatSearchFilters) {
  const conditions: string[] = ["b.status = 'active'", buildVisibleImportQualitySql("b")];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters.search) {
    conditions.push(
      `LOWER(CONCAT_WS(' ',
        b.make,
        b.model,
        COALESCE(d.ai_summary, ''),
        COALESCE(b.location_text, ''),
        COALESCE(b.source_name, ''),
        COALESCE(b.source_site, ''),
        array_to_string(COALESCE(d.character_tags, '{}'), ' '),
        COALESCE(d.specs->>'rig_type', ''),
        COALESCE(d.specs->>'hull_material', '')
      )) LIKE $${paramIdx++}`
    );
    params.push(`%${filters.search.toLowerCase()}%`);
  }

  if (filters.location) {
    conditions.push(`LOWER(COALESCE(b.location_text, '')) LIKE $${paramIdx++}`);
    params.push(`%${filters.location.toLowerCase()}%`);
  }

  if (filters.minPrice) {
    conditions.push(`${PRICE_USD_SQL} >= $${paramIdx++}`);
    params.push(convertCurrencyToUsd(parseFloat(filters.minPrice), filters.currency));
  }
  if (filters.maxPrice) {
    conditions.push(`${PRICE_USD_SQL} <= $${paramIdx++}`);
    params.push(convertCurrencyToUsd(parseFloat(filters.maxPrice), filters.currency));
  }
  if (filters.minYear) {
    conditions.push(`b.year >= $${paramIdx++}`);
    params.push(parseInt(filters.minYear, 10));
  }
  if (filters.maxYear) {
    conditions.push(`b.year <= $${paramIdx++}`);
    params.push(parseInt(filters.maxYear, 10));
  }
  if (filters.rigType) {
    conditions.push(`LOWER(COALESCE(d.specs->>'rig_type', '')) = LOWER($${paramIdx++})`);
    params.push(filters.rigType);
  }
  if (filters.hullType) {
    conditions.push(`LOWER(COALESCE(d.specs->>'vessel_type', '')) = LOWER($${paramIdx++})`);
    params.push(filters.hullType);
  }
  if (filters.tag) {
    conditions.push(`$${paramIdx++} = ANY(COALESCE(d.character_tags, '{}'))`);
    params.push(filters.tag);
  }

  return {
    where: conditions.join(" AND "),
    params,
  };
}

function formatMoneyLabel(
  minPrice: string | null,
  maxPrice: string | null,
  currency: SupportedCurrency
) {
  const prefix = currency === "USD" ? "$" : `${currency} `;

  const format = (value: string) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    if (amount >= 1_000_000) {
      return `${prefix}${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
    }
    if (amount >= 1_000) return `${prefix}${Math.round(amount / 1_000)}k`;
    return `${prefix}${Math.round(amount)}`;
  };

  if (minPrice && maxPrice) {
    return `${format(minPrice)}-${format(maxPrice)}`;
  }
  if (minPrice) return `${format(minPrice)}+`;
  if (maxPrice) return `Up to ${format(maxPrice)}`;
  return null;
}

function formatYearLabel(minYear: string | null, maxYear: string | null) {
  if (minYear && maxYear) return `${minYear}-${maxYear}`;
  if (minYear) return `${minYear}+`;
  if (maxYear) return `Up to ${maxYear}`;
  return null;
}

function humanize(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildSavedSearchName(filters: Partial<BoatSearchFilters>) {
  const normalized = normalizeBoatSearchFilters(filters);
  const parts: string[] = [];

  if (normalized.search) {
    parts.push(normalized.search);
  } else if (normalized.location) {
    parts.push(`In ${humanize(normalized.location)}`);
  } else if (normalized.tag) {
    parts.push(humanize(normalized.tag));
  } else if (normalized.rigType) {
    parts.push(`${humanize(normalized.rigType)} rigs`);
  } else if (normalized.hullType) {
    parts.push(`${humanize(normalized.hullType)} hulls`);
  } else {
    parts.push("All boats");
  }

  const moneyLabel = formatMoneyLabel(
    normalized.minPrice,
    normalized.maxPrice,
    normalized.currency
  );
  if (moneyLabel) parts.push(moneyLabel);

  const yearLabel = formatYearLabel(normalized.minYear, normalized.maxYear);
  if (yearLabel) parts.push(yearLabel);

  if (
    normalized.location &&
    !parts.some((part) => part.toLowerCase().includes(normalized.location!.toLowerCase()))
  ) {
    parts.push(`In ${humanize(normalized.location)}`);
  }

  if (
    normalized.rigType &&
    !parts.some((part) => part.toLowerCase().includes(normalized.rigType!.toLowerCase()))
  ) {
    parts.push(humanize(normalized.rigType));
  }
  if (normalized.hullType) {
    parts.push(humanize(normalized.hullType));
  }

  return parts.join(" | ");
}

export function buildSavedSearchSignature(filters: Partial<BoatSearchFilters>) {
  const normalized = normalizeBoatSearchFilters(filters);

  return JSON.stringify({
    search: normalized.search,
    location: normalized.location,
    tag: normalized.tag,
    currency: normalized.currency,
    minPrice: normalized.minPrice,
    maxPrice: normalized.maxPrice,
    minYear: normalized.minYear,
    maxYear: normalized.maxYear,
    rigType: normalized.rigType,
    hullType: normalized.hullType,
  });
}
