"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  addCompareBoatId,
  clearCompareBoatIds,
  COMPARE_UPDATED_EVENT,
  hasComparedBoat,
  MAX_COMPARE_BOATS,
  readCompareBoatIds,
  removeCompareBoatId,
  toggleCompareBoatId,
} from "@/lib/compare";

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
  return [];
}

export function useCompareBoats() {
  const compareIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleBoat = useCallback((boatId: string) => toggleCompareBoatId(boatId), []);
  const addBoat = useCallback((boatId: string) => addCompareBoatId(boatId), []);
  const removeBoat = useCallback((boatId: string) => removeCompareBoatId(boatId), []);
  const clear = useCallback(() => clearCompareBoatIds(), []);

  return useMemo(
    () => ({
      compareIds,
      compareCount: compareIds.length,
      maxCompareBoats: MAX_COMPARE_BOATS,
      isCompared: (boatId: string) => hasComparedBoat(boatId),
      toggleBoat,
      addBoat,
      removeBoat,
      clear,
    }),
    [addBoat, clear, compareIds, removeBoat, toggleBoat]
  );
}
