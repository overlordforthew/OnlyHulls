export type MatchSort = "match" | "price" | "year" | "size" | "newest";
export type SortDir = "asc" | "desc";

export function parseMatchSort(value: string | null): MatchSort {
  return value === "price" || value === "year" || value === "size" || value === "newest"
    ? value
    : "match";
}

export function parseMatchDir(value: string | null, sort: MatchSort): SortDir {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return sort === "price" || sort === "size" ? "asc" : "desc";
}

export function buildMatchOrderBy(sort: MatchSort, dir: SortDir) {
  switch (sort) {
    case "price":
      return `COALESCE(b.asking_price_usd, b.asking_price) ${dir.toUpperCase()} NULLS LAST, m.score DESC NULLS LAST`;
    case "year":
      return `b.year ${dir.toUpperCase()} NULLS LAST, m.score DESC NULLS LAST`;
    case "size":
      return `COALESCE((d.specs->>'loa')::numeric, 0) ${dir.toUpperCase()} NULLS LAST, m.score DESC NULLS LAST`;
    case "newest":
      return `COALESCE(b.listing_date, DATE(b.created_at)) ${dir.toUpperCase()} NULLS LAST, m.score DESC NULLS LAST`;
    case "match":
    default:
      return `m.score ${dir.toUpperCase()} NULLS LAST, COALESCE(b.asking_price_usd, b.asking_price) ASC NULLS LAST, b.year DESC NULLS LAST`;
  }
}
