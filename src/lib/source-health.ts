import { getSourceDecisionByName } from "@/lib/source-policy";

export type SourceHealthPolicySignal =
  | "source_policy_undecided"
  | "source_freshness_suppresses_visible_inventory"
  | "hold_has_public_visible_inventory"
  | "hold_suppresses_pre_policy_visible_inventory";

function clampDelta(left: number, right: number) {
  return Math.max(0, left - right);
}

export function deriveImportVisibilityCounts(input: {
  active: number;
  qualityVisibleBeforeFreshness: number;
  qualityVisibleBeforePolicy: number;
  visible: number;
}) {
  return {
    qualitySuppressedCount: clampDelta(input.active, input.qualityVisibleBeforeFreshness),
    freshnessSuppressedCount: clampDelta(
      input.qualityVisibleBeforeFreshness,
      input.qualityVisibleBeforePolicy
    ),
    policySuppressedCount: clampDelta(input.qualityVisibleBeforePolicy, input.visible),
    hiddenCount: clampDelta(input.active, input.visible),
  };
}

export function buildSourceHealthPolicySignals(input: {
  source: string;
  active: number;
  qualityVisibleBeforeFreshness?: number;
  visible: number;
  qualityVisibleBeforePolicy: number;
}): SourceHealthPolicySignal[] {
  const decision = getSourceDecisionByName(input.source);
  const signals: SourceHealthPolicySignal[] = [];

  if (!decision && input.active > 0) {
    signals.push("source_policy_undecided");
    return signals;
  }

  if (decision?.status !== "hold") {
    if (
      typeof input.qualityVisibleBeforeFreshness === "number" &&
      input.qualityVisibleBeforeFreshness > input.qualityVisibleBeforePolicy
    ) {
      signals.push("source_freshness_suppresses_visible_inventory");
    }

    return signals;
  }

  if (
    typeof input.qualityVisibleBeforeFreshness === "number" &&
    input.qualityVisibleBeforeFreshness > input.qualityVisibleBeforePolicy
  ) {
    signals.push("source_freshness_suppresses_visible_inventory");
  }

  if (input.visible > 0) {
    signals.push("hold_has_public_visible_inventory");
  }

  if (input.qualityVisibleBeforePolicy > input.visible) {
    signals.push("hold_suppresses_pre_policy_visible_inventory");
  }

  return signals;
}
