import { getSourceDecisionByName } from "@/lib/source-policy";

export type SourceHealthPolicySignal =
  | "source_policy_undecided"
  | "hold_has_public_visible_inventory"
  | "hold_suppresses_pre_policy_visible_inventory";

export function buildSourceHealthPolicySignals(input: {
  source: string;
  active: number;
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
    return signals;
  }

  if (input.visible > 0) {
    signals.push("hold_has_public_visible_inventory");
  }

  if (input.qualityVisibleBeforePolicy > input.visible) {
    signals.push("hold_suppresses_pre_policy_visible_inventory");
  }

  return signals;
}
