import { formatCurrencyAmount, normalizeSupportedCurrency } from "@/lib/currency";

type JsonObject = Record<string, unknown>;

export interface BuyerProfileSummaryItem {
  label: string;
  value: string;
}

export interface BuyerProfileSummary {
  items: BuyerProfileSummaryItem[];
}

const USE_CASE_LABELS: Record<string, string> = {
  charter: "Charter",
  cruising: "Cruising",
  fishing: "Fishing",
  liveaboard: "Liveaboard",
  racing: "Racing",
  weekender: "Weekend sailing",
};

const BOAT_TYPE_LABELS: Record<string, string> = {
  monohull: "Monohull",
  catamaran: "Catamaran",
  trimaran: "Trimaran",
  powerboat: "Powerboat",
};

const TIMELINE_LABELS: Record<string, string> = {
  browsing: "Just browsing",
  "3mo": "Buying in 3 months",
  "6mo": "Buying in 6 months",
  "12mo": "Buying in 12 months",
  ready: "Ready to buy now",
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => String(entry).trim())
        .filter(Boolean)
    : [];
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatShortList(values: string[], maxItems = 2): string | null {
  if (!values.length) return null;
  if (values.length <= maxItems) {
    return values.join(", ");
  }

  return `${values.slice(0, maxItems).join(", ")} +${values.length - maxItems} more`;
}

function formatBudgetRange(budgetRange: JsonObject | null | undefined): string | null {
  const currency = normalizeSupportedCurrency(
    typeof budgetRange?.currency === "string" ? budgetRange.currency : null
  );
  const min = asFiniteNumber(budgetRange?.min);
  const max = asFiniteNumber(budgetRange?.max);

  if (min === null && max === null) return null;
  if (max === null || max >= 999_999_999) {
    return min !== null && min > 0 ? `${formatCurrencyAmount(min, currency)}+` : null;
  }
  if ((min ?? 0) <= 0) {
    return `Under ${formatCurrencyAmount(max, currency)}`;
  }
  if (min === null) {
    return formatCurrencyAmount(max, currency);
  }
  if (min === max) {
    return formatCurrencyAmount(min, currency);
  }

  return `${formatCurrencyAmount(min, currency)} to ${formatCurrencyAmount(max, currency)}`;
}

function formatBoatTypePrefs(boatTypePrefs: JsonObject | null | undefined): string | null {
  const types = toStringArray(boatTypePrefs?.types)
    .map((value) => value.toLowerCase())
    .filter((value) => value && value !== "no-preference");
  const rigPrefs = toStringArray(boatTypePrefs?.rig_prefs)
    .map((value) => value.toLowerCase())
    .filter((value) => value && value !== "no-preference");

  if (!types.length && !rigPrefs.length) {
    return "All boat types";
  }

  const typeLabel = formatShortList(
    types.map((value) => BOAT_TYPE_LABELS[value] || titleCase(value)),
    2
  );
  const rigLabel = formatShortList(rigPrefs.map(titleCase), 2);

  if (typeLabel && rigLabel && types.length === 1 && types[0] === "monohull") {
    return `${typeLabel} (${rigLabel})`;
  }

  return typeLabel || rigLabel;
}

function formatSpecPreferences(specPreferences: JsonObject | null | undefined): string | null {
  const loaMin = asFiniteNumber(specPreferences?.loa_min);
  const loaMax = asFiniteNumber(specPreferences?.loa_max);
  const yearMin = asFiniteNumber(specPreferences?.year_min);

  const parts: string[] = [];
  if (loaMin !== null && loaMax !== null) {
    parts.push(`${loaMin}-${loaMax} ft`);
  } else if (loaMin !== null) {
    parts.push(`${loaMin}+ ft`);
  } else if (loaMax !== null) {
    parts.push(`Up to ${loaMax} ft`);
  }

  if (yearMin !== null) {
    parts.push(`${yearMin}+`);
  }

  return parts.length ? parts.join(" / ") : null;
}

function formatLocationPreferences(locationPreferences: JsonObject | null | undefined): string | null {
  const regions = toStringArray(locationPreferences?.regions).map(titleCase);
  const homePort =
    typeof locationPreferences?.home_port === "string"
      ? locationPreferences.home_port.trim()
      : "";

  if (regions.length) {
    return formatShortList(regions, 2);
  }
  if (homePort) {
    return homePort;
  }

  return null;
}

function formatUseCases(useCase: unknown): string | null {
  const values = toStringArray(useCase).map(
    (value) => USE_CASE_LABELS[value.toLowerCase()] || titleCase(value)
  );
  return formatShortList(values, 2);
}

function formatTimeline(timeline: unknown): string | null {
  if (typeof timeline !== "string" || !timeline.trim()) return null;
  return TIMELINE_LABELS[timeline] || titleCase(timeline);
}

export function buildBuyerProfileSummary(profile: {
  use_case: string[] | null;
  budget_range: JsonObject | null;
  boat_type_prefs: JsonObject | null;
  spec_preferences: JsonObject | null;
  location_prefs: JsonObject | null;
  timeline?: string | null;
}): BuyerProfileSummary {
  const items: BuyerProfileSummaryItem[] = [];

  const mission = formatUseCases(profile.use_case);
  if (mission) {
    items.push({ label: "Mission", value: mission });
  }

  const boatType = formatBoatTypePrefs(profile.boat_type_prefs);
  if (boatType) {
    items.push({ label: "Boat type", value: boatType });
  }

  const budget = formatBudgetRange(profile.budget_range);
  if (budget) {
    items.push({ label: "Budget", value: budget });
  }

  const specs = formatSpecPreferences(profile.spec_preferences);
  if (specs) {
    items.push({ label: "Size and year", value: specs });
  }

  const location = formatLocationPreferences(profile.location_prefs);
  if (location) {
    items.push({ label: "Sailing area", value: location });
  }

  const timeline = formatTimeline(profile.timeline);
  if (timeline) {
    items.push({ label: "Timing", value: timeline });
  }

  return { items };
}
