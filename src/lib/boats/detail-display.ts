export interface BoatDetailFactLabels {
  year: string;
  location: string;
  loa: string;
}

export interface BoatDetailFact {
  key: "year" | "location" | "loa";
  label: string;
  value: string;
}

function normalizeBoatYear(year: number | string | null | undefined) {
  if (typeof year === "number") {
    return Number.isFinite(year) && year > 0 ? String(Math.trunc(year)) : "";
  }

  const trimmed = String(year || "").trim();
  if (!trimmed) return "";

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return numeric > 0 ? String(Math.trunc(numeric)) : "";
  }

  return trimmed;
}

function formatLengthFeet(value: unknown) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return `${Number.isInteger(value) ? value : Number(value.toFixed(1))} ft`;
  }

  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return numeric > 0 ? `${Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(1))} ft` : null;
  }

  return trimmed;
}

export function buildBoatDisplayTitle(boat: {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
}) {
  const year = normalizeBoatYear(boat.year);

  return [year, boat.make, boat.model]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

export function buildBoatDetailFacts(input: {
  year?: number | string | null;
  locationText?: string | null;
  specs?: Record<string, unknown> | null;
  labels: BoatDetailFactLabels;
}): BoatDetailFact[] {
  const facts: BoatDetailFact[] = [];
  const year = normalizeBoatYear(input.year);
  const location = String(input.locationText || "").trim();
  const loa = formatLengthFeet(input.specs?.loa);

  if (year) {
    facts.push({ key: "year", label: input.labels.year, value: year });
  }

  if (location) {
    facts.push({ key: "location", label: input.labels.location, value: location });
  }

  if (loa) {
    facts.push({ key: "loa", label: input.labels.loa, value: loa });
  }

  return facts;
}
