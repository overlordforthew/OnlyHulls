export const COMPARE_STORAGE_KEY = "onlyhulls_compare_boats";
export const COMPARE_UPDATED_EVENT = "compare-boats:updated";
export const MAX_COMPARE_BOATS = 4;

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean))).slice(
    0,
    MAX_COMPARE_BOATS
  );
}

export function readCompareBoatIds(): string[] {
  if (!isBrowser()) return [];

  try {
    const stored = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return normalizeIds(parsed);
  } catch {
    return [];
  }
}

function persistCompareBoatIds(ids: string[]) {
  if (!isBrowser()) return;

  const normalized = normalizeIds(ids);
  window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(
    new CustomEvent(COMPARE_UPDATED_EVENT, {
      detail: { ids: normalized },
    })
  );
}

export function setCompareBoatIds(ids: string[]) {
  persistCompareBoatIds(ids);
}

export function addCompareBoatId(boatId: string) {
  const ids = readCompareBoatIds();
  if (ids.includes(boatId)) return ids;
  const next = [...ids, boatId].slice(0, MAX_COMPARE_BOATS);
  persistCompareBoatIds(next);
  return next;
}

export function removeCompareBoatId(boatId: string) {
  const next = readCompareBoatIds().filter((id) => id !== boatId);
  persistCompareBoatIds(next);
  return next;
}

export function toggleCompareBoatId(boatId: string) {
  const ids = readCompareBoatIds();
  if (ids.includes(boatId)) {
    return removeCompareBoatId(boatId);
  }
  return addCompareBoatId(boatId);
}

export function clearCompareBoatIds() {
  persistCompareBoatIds([]);
}

export function hasComparedBoat(boatId: string) {
  return readCompareBoatIds().includes(boatId);
}
