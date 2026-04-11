"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  addCompareBoatId,
  clearCompareBoatIds,
  COMPARE_UPDATED_EVENT,
  MAX_COMPARE_BOATS,
  readCompareBoatIds,
  removeCompareBoatId,
  toggleCompareBoatId,
} from "@/lib/compare";

const EMPTY_COMPARE_IDS: string[] = [];

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(COMPARE_UPDATED_EVENT, onStoreChange as EventListener);
  window.addEventListener("focus", onStoreChange);
  return () => {
    window.removeEventListener(COMPARE_UPDATED_EVENT, onStoreChange as EventListener);
    window.removeEventListener("focus", onStoreChange);
  };
}

function getSnapshot() {
  return readCompareBoatIds();
}

function getServerSnapshot() {
  return EMPTY_COMPARE_IDS;
}

export function useCompareBoats() {
  const compareIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const comparedBoatIds = useMemo(() => new Set(compareIds), [compareIds]);

  const toggleBoat = useCallback((boatId: string) => toggleCompareBoatId(boatId), []);
  const addBoat = useCallback((boatId: string) => addCompareBoatId(boatId), []);
  const removeBoat = useCallback((boatId: string) => removeCompareBoatId(boatId), []);
  const clear = useCallback(() => clearCompareBoatIds(), []);
  const isCompared = useCallback(
    (boatId: string) => comparedBoatIds.has(boatId),
    [comparedBoatIds]
  );

  return useMemo(
    () => ({
      compareIds,
      compareCount: compareIds.length,
      maxCompareBoats: MAX_COMPARE_BOATS,
      isCompared,
      toggleBoat,
      addBoat,
      removeBoat,
      clear,
    }),
    [addBoat, clear, compareIds, isCompared, removeBoat, toggleBoat]
  );
}
