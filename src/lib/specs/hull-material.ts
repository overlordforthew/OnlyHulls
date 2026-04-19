const HULL_FORM_TO_VESSEL_TYPE: Record<string, string> = {
  cat: "catamaran",
  catamaran: "catamaran",
  "multi hull": "catamaran",
  multihull: "catamaran",
  monohull: "monohull",
  "mono hull": "monohull",
  sailboat: "monohull",
  "sail boat": "monohull",
  trimaran: "trimaran",
  flybridge: "powerboat",
  motoryacht: "powerboat",
  "motor yacht": "powerboat",
  powerboat: "powerboat",
  "power boat": "powerboat",
};

function normalizeHullMaterialToken(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ");

  return normalized || null;
}

export function vesselTypeFromHullForm(value: unknown): string | null {
  const normalized = normalizeHullMaterialToken(value);
  return normalized ? HULL_FORM_TO_VESSEL_TYPE[normalized] ?? null : null;
}

export function isHullMaterialActuallyVesselType(value: unknown): boolean {
  return vesselTypeFromHullForm(value) !== null;
}

export function sanitizeHullMaterial(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || isHullMaterialActuallyVesselType(trimmed)) return null;

  return trimmed;
}
