export const COMPARE_STORAGE_KEY = "onlyhulls_compare_boats";
export const COMPARE_UPDATED_EVENT = "compare-boats:updated";
export const MAX_COMPARE_BOATS = 4;
const EMPTY_COMPARE_IDS: string[] = [];

let compareCache = {
  serialized: "[]",
  ids: EMPTY_COMPARE_IDS,
};

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean))).slice(
    0,
    MAX_COMPARE_BOATS
  );
}

function serializeCompareIds(ids: string[]) {
  return JSON.stringify(ids);
}

function readPersistedCompareIds(): string[] {
  if (!isBrowser()) return EMPTY_COMPARE_IDS;

  try {
    const stored = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!stored) return EMPTY_COMPARE_IDS;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return EMPTY_COMPARE_IDS;
    return normalizeIds(parsed);
  } catch {
    return EMPTY_COMPARE_IDS;
  }
}

function cacheCompareBoatIds(ids: string[]) {
  const normalized = normalizeIds(ids);
  const serialized = serializeCompareIds(normalized);
  if (serialized === compareCache.serialized) {
    return compareCache.ids;
  }

  compareCache = {
    serialized,
    ids: normalized.length > 0 ? normalized : EMPTY_COMPARE_IDS,
  };

  return compareCache.ids;
}

export function readCompareBoatIds(): string[] {
  return cacheCompareBoatIds(readPersistedCompareIds());
}

function persistCompareBoatIds(ids: string[]) {
  if (!isBrowser()) return;

  const normalized = cacheCompareBoatIds(ids);
  if (compareCache.serialized === window.localStorage.getItem(COMPARE_STORAGE_KEY)) {
    return;
  }

  window.localStorage.setItem(COMPARE_STORAGE_KEY, compareCache.serialized);
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
