import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import { convertCurrencyToUsd, normalizeSupportedCurrency, type SupportedCurrency } from "@/lib/currency";

export type BoatSortField = "price" | "size" | "year" | "newest";
export type BoatSortDir = "asc" | "desc";

export interface BoatSearchFilters {
  search: string;
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
    price: "COALESCE(b.asking_price_usd, b.asking_price)",
    size: "CAST(NULLIF(REGEXP_REPLACE(d.specs->>'loa', '[^0-9.]', '', 'g'), '') AS float)",
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

  return `${listingBoost}(EXISTS (SELECT 1 FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image')) DESC, ${sortCol} ${sortDir} NULLS LAST`;
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

  if (filters.minPrice) {
    conditions.push(`COALESCE(b.asking_price_usd, b.asking_price) >= $${paramIdx++}`);
    params.push(convertCurrencyToUsd(parseFloat(filters.minPrice), filters.currency));
  }
  if (filters.maxPrice) {
    conditions.push(`COALESCE(b.asking_price_usd, b.asking_price) <= $${paramIdx++}`);
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
    conditions.push(`LOWER(COALESCE(d.specs->>'hull_material', '')) = LOWER($${paramIdx++})`);
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

function formatMoneyLabel(minPrice: string | null, maxPrice: string | null) {
  const format = (value: string) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
    if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`;
    return `$${Math.round(amount)}`;
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
  } else if (normalized.tag) {
    parts.push(humanize(normalized.tag));
  } else if (normalized.rigType) {
    parts.push(`${humanize(normalized.rigType)} rigs`);
  } else if (normalized.hullType) {
    parts.push(`${humanize(normalized.hullType)} hulls`);
  } else {
    parts.push("All boats");
  }

  const moneyLabel = formatMoneyLabel(normalized.minPrice, normalized.maxPrice);
  if (moneyLabel) parts.push(moneyLabel);

  const yearLabel = formatYearLabel(normalized.minYear, normalized.maxYear);
  if (yearLabel) parts.push(yearLabel);

  if (
    normalized.rigType &&
    !parts.some((part) => part.toLowerCase().includes(normalized.rigType!.toLowerCase()))
  ) {
    parts.push(humanize(normalized.rigType));
  }
  if (normalized.hullType) {
    parts.push(humanize(normalized.hullType));
  }

  return parts.join(" • ");
}

export function buildSavedSearchSignature(filters: Partial<BoatSearchFilters>) {
  const normalized = normalizeBoatSearchFilters(filters);

  return JSON.stringify({
    search: normalized.search,
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
