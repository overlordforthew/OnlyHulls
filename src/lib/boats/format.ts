// Shared boat-length formatter. Used by BoatCard alt + visible specs, the
// map sidebar row, and the map popup so what a screen reader announces
// matches what the page visually displays. Integer LOAs stay as "42",
// non-integers round to one decimal and drop a trailing ".0" ("42.5",
// not "42.50").
export function formatBoatLengthNumber(loa: number | null | undefined): string | null {
  if (loa === null || loa === undefined) return null;
  if (!Number.isFinite(loa)) return null;
  return Number.isInteger(loa) ? String(loa) : loa.toFixed(1).replace(/\.0$/, "");
}

// Format a boat length with the unit label. Pass a locale-aware unit
// ("ft" for en, "pies" for es). Returns null when the value is unusable.
export function formatBoatLengthWithUnit(
  loa: number | null | undefined,
  unit: string
): string | null {
  const number = formatBoatLengthNumber(loa);
  if (number === null) return null;
  return `${number} ${unit}`;
}
