export function buildBoatDisplayTitle(boat: {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
}) {
  const year =
    typeof boat.year === "number"
      ? Number.isFinite(boat.year) && boat.year > 0
        ? String(Math.trunc(boat.year))
        : ""
      : String(boat.year || "").trim();

  return [year, boat.make, boat.model]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}
