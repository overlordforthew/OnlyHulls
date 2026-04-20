import {
  convertCurrencyToUsd,
  convertUsdToCurrency,
  formatCurrencyAmount,
  type SupportedCurrency,
} from "@/lib/currency";
import { getComparePageCopy, type CompareAnalysisCopy } from "@/i18n/copy/compare";
import { sanitizeHullMaterial } from "@/lib/specs/hull-material";

const DEFAULT_COMPARE_ANALYSIS_COPY = getComparePageCopy("en").analysis;

export interface CompareSpecs {
  loa?: number;
  vessel_type?: string;
  rig_type?: string;
  beam?: number;
  draft?: number;
  hull_material?: string;
  engine?: string;
  cabins?: number;
  berths?: number;
  heads?: number;
  fuel_type?: string;
  keel_type?: string;
  displacement?: number;
}

export interface CompareBoat {
  id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  asking_price_usd?: number | null;
  location_text: string | null;
  slug: string | null;
  is_sample: boolean;
  hero_url: string | null;
  image_count?: number;
  specs: CompareSpecs;
  character_tags: string[];
  source_site?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  seller_subscription_tier?: string | null;
  condition_score?: number | null;
}

export type NumericPreference = "high" | "low";

export interface QuickFactor {
  label: string;
  winnerId: string;
  winnerTitle: string;
  detail: string;
}

export interface BoatInsight {
  strengths: string[];
  watchouts: string[];
}

export interface ActionRecommendation {
  winnerId: string;
  winnerTitle: string;
  detail: string;
}

export interface BestFitSignal {
  label: string;
  reason: string;
}

const SOURCE_NAMES: Record<string, string> = {
  sailboatlistings: "Sailboat Listings",
  theyachtmarket: "The Yacht Market",
  catamarans_com: "Catamarans.com",
  catamaransite: "Catamaran Site",
  camperandnicholsons: "Camper & Nicholsons",
  denison: "Denison Yachting",
  dreamyacht: "Dream Yacht Sales",
  moorings: "The Moorings",
  multihullcompany: "Multihull Company",
  multihullworld: "Multihull World",
  apolloduck_us: "Apollo Duck",
  boote_yachten: "Boote & Yachten",
  vi_yachtbroker: "VI Yacht Broker",
};

export function formatBoatTitle(boat: Pick<CompareBoat, "year" | "make" | "model">) {
  return `${boat.year} ${boat.make} ${boat.model}`.replace(/\s+/g, " ").trim();
}

export function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatTextValue(value: string | null | undefined, fallback = "—") {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export function formatCount(value: unknown) {
  const count = toFiniteNumber(value);
  return count !== null ? String(count) : "—";
}

export function formatFeet(value: unknown) {
  const feet = toFiniteNumber(value);
  return feet !== null ? `${feet}ft` : "—";
}

export function formatKilograms(
  value: unknown,
  formatNumber: (value: number) => string = (number) => number.toLocaleString("en-US")
) {
  const kilograms = toFiniteNumber(value);
  return kilograms !== null ? `${formatNumber(Math.round(kilograms))} kg` : "—";
}

export function getBoatPriceUsd(boat: CompareBoat) {
  if (toFiniteNumber(boat.asking_price_usd) !== null) {
    return boat.asking_price_usd as number;
  }

  if (boat.currency === "USD") {
    return boat.asking_price;
  }

  return convertCurrencyToUsd(boat.asking_price, boat.currency as SupportedCurrency);
}

export function getPricePerFootUsd(boat: CompareBoat) {
  const loa = toFiniteNumber(boat.specs.loa);
  if (!loa || loa <= 0) {
    return null;
  }

  return getBoatPriceUsd(boat) / loa;
}

export function formatPriceFromUsd(amountUsd: number, currency: SupportedCurrency) {
  return formatCurrencyAmount(convertUsdToCurrency(amountUsd, currency), currency);
}

export function formatPricePerFoot(
  boat: CompareBoat,
  currency: SupportedCurrency,
  copy: CompareAnalysisCopy = DEFAULT_COMPARE_ANALYSIS_COPY
) {
  const amountUsd = getPricePerFootUsd(boat);
  if (amountUsd === null) {
    return "—";
  }

  return `${formatPriceFromUsd(amountUsd, currency)}${copy.units.perFoot}`;
}

export function getListingPathLabel(
  boat: CompareBoat,
  copy: CompareAnalysisCopy = DEFAULT_COMPARE_ANALYSIS_COPY
) {
  if (boat.source_url) {
    return copy.listingPath.imported(formatSourceSite(boat.source_site));
  }

  if (
    boat.seller_subscription_tier === "featured" ||
    boat.seller_subscription_tier === "broker"
  ) {
    return copy.listingPath.directFeatured;
  }

  return copy.listingPath.directOnlyHulls;
}

export function formatSourceSite(source: string | null | undefined) {
  if (!source) {
    return "partner";
  }

  return SOURCE_NAMES[source] || source.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getWinningNumericBoatIds(
  boats: CompareBoat[],
  numericValue: (boat: CompareBoat) => number | null,
  numericPreference: NumericPreference
) {
  const entries = boats
    .map((boat) => {
      const value = numericValue(boat);
      return value !== null && Number.isFinite(value) ? { id: boat.id, value } : null;
    })
    .filter((entry): entry is { id: string; value: number } => entry !== null);

  if (entries.length < 2) {
    return new Set<string>();
  }

  const distinctValues = new Set(entries.map((entry) => entry.value));
  if (distinctValues.size === 1) {
    return new Set<string>();
  }

  const target =
    numericPreference === "low"
      ? Math.min(...entries.map((entry) => entry.value))
      : Math.max(...entries.map((entry) => entry.value));

  return new Set(entries.filter((entry) => entry.value === target).map((entry) => entry.id));
}

export function buildQuickFactors(
  boats: CompareBoat[],
  currency: SupportedCurrency,
  copy: CompareAnalysisCopy = DEFAULT_COMPARE_ANALYSIS_COPY
): QuickFactor[] {
  const factors = [
    createQuickFactor({
      boats,
      label: copy.quickFactors.lowestBuyIn.label,
      numericPreference: "low",
      value: getBoatPriceUsd,
      detail: (winner, runnerUp) => {
        if (!runnerUp) {
          return copy.quickFactors.lowestBuyIn.onlyWinner(
            formatPriceFromUsd(getBoatPriceUsd(winner), currency)
          );
        }

        const savings = Math.abs(getBoatPriceUsd(runnerUp) - getBoatPriceUsd(winner));
        return copy.quickFactors.lowestBuyIn.savings(
          formatPriceFromUsd(savings, currency),
          formatBoatTitle(runnerUp)
        );
      },
    }),
    createQuickFactor({
      boats,
      label: copy.quickFactors.pricePerFootEdge.label,
      numericPreference: "low",
      value: getPricePerFootUsd,
      detail: (winner) =>
        copy.quickFactors.pricePerFootEdge.detail(formatPricePerFoot(winner, currency, copy)),
    }),
    createQuickFactor({
      boats,
      label: copy.quickFactors.newestBuild.label,
      numericPreference: "high",
      value: (boat) => boat.year,
      detail: (winner, runnerUp) => {
        if (!runnerUp) {
          return copy.quickFactors.newestBuild.onlyWinner(winner.year);
        }

        return copy.quickFactors.newestBuild.advantage(
          winner.year - runnerUp.year,
          formatBoatTitle(runnerUp)
        );
      },
    }),
    createQuickFactor({
      boats,
      label: copy.quickFactors.longestHull.label,
      numericPreference: "high",
      value: (boat) => toFiniteNumber(boat.specs.loa),
      detail: (winner, runnerUp) => {
        if (!runnerUp || toFiniteNumber(runnerUp.specs.loa) === null) {
          return copy.quickFactors.longestHull.onlyWinner(formatFeet(winner.specs.loa));
        }

        const advantage = (winner.specs.loa as number) - (runnerUp.specs.loa as number);
        return copy.quickFactors.longestHull.advantage(
          formatFeet(winner.specs.loa),
          advantage.toFixed(1),
          formatBoatTitle(runnerUp)
        );
      },
    }),
    createQuickFactor({
      boats,
      label: copy.quickFactors.shallowerDraft.label,
      numericPreference: "low",
      value: (boat) => toFiniteNumber(boat.specs.draft),
      detail: (winner, runnerUp) => {
        if (!runnerUp || toFiniteNumber(runnerUp.specs.draft) === null) {
          return copy.quickFactors.shallowerDraft.onlyWinner(formatFeet(winner.specs.draft));
        }

        const margin = (runnerUp.specs.draft as number) - (winner.specs.draft as number);
        return copy.quickFactors.shallowerDraft.advantage(
          formatFeet(winner.specs.draft),
          margin.toFixed(1),
          formatBoatTitle(runnerUp)
        );
      },
    }),
    createQuickFactor({
      boats,
      label: copy.quickFactors.accommodationEdge.label,
      numericPreference: "high",
      value: (boat) =>
        scoreAccommodation(boat.specs.cabins, boat.specs.berths, boat.specs.heads),
      detail: (winner) =>
        copy.quickFactors.accommodationEdge.detail(
          [
            toFiniteNumber(winner.specs.cabins)
              ? copy.quickFactors.accommodationEdge.cabins(String(winner.specs.cabins))
              : null,
            toFiniteNumber(winner.specs.berths)
              ? copy.quickFactors.accommodationEdge.berths(String(winner.specs.berths))
              : null,
            toFiniteNumber(winner.specs.heads)
              ? copy.quickFactors.accommodationEdge.heads(String(winner.specs.heads))
              : null,
          ].filter((part): part is string => Boolean(part))
        ),
    }),
  ].filter((factor): factor is QuickFactor => factor !== null);

  return factors.slice(0, 4);
}

export function buildActionRecommendation(
  boats: CompareBoat[],
  currency: SupportedCurrency,
  copy: CompareAnalysisCopy = DEFAULT_COMPARE_ANALYSIS_COPY
): ActionRecommendation | null {
  const entries = boats
    .map((boat) => ({ boat, score: getActionScore(boat) }))
    .sort((a, b) => b.score - a.score);

  if (entries.length === 0) {
    return null;
  }

  const winner = entries[0];
  const runnerUp = entries[1];
  if (runnerUp && winner.score === runnerUp.score) {
    return null;
  }

  const reasons = [
    !winner.boat.source_url ? copy.actionRecommendation.directPath : copy.actionRecommendation.importedPath,
    winner.boat.condition_score
      ? copy.actionRecommendation.condition(Math.round(winner.boat.condition_score))
      : null,
    winner.boat.image_count ? copy.actionRecommendation.images(winner.boat.image_count) : null,
    winner.boat.location_text ? copy.actionRecommendation.specificLocationShown : null,
    getPricePerFootUsd(winner.boat) !== null
      ? formatPricePerFoot(winner.boat, currency, copy)
      : null,
  ].filter(Boolean);

  return {
    winnerId: winner.boat.id,
    winnerTitle: formatBoatTitle(winner.boat),
    detail: copy.actionRecommendation.detail(reasons.slice(0, 3).join(", ")),
  };
}

export function buildBoatInsights(
  boats: CompareBoat[],
  copy: CompareAnalysisCopy = DEFAULT_COMPARE_ANALYSIS_COPY
) {
  const insights = new Map<string, BoatInsight>();

  for (const boat of boats) {
    insights.set(boat.id, { strengths: [], watchouts: [] });
  }

  const comparativeSignals: Array<{
    value: (boat: CompareBoat) => number | null;
    preference: NumericPreference;
    strength: string;
    watchout: string;
  }> = [
    {
      value: getBoatPriceUsd,
      preference: "low",
      strength: copy.insights.lowestBuyIn,
      watchout: copy.insights.highestAskingPrice,
    },
    {
      value: getPricePerFootUsd,
      preference: "low",
      strength: copy.insights.lowerPricePerFoot,
      watchout: copy.insights.higherPricePerFoot,
    },
    {
      value: (boat) => boat.year,
      preference: "high",
      strength: copy.insights.newestBuildYear,
      watchout: copy.insights.oldestBuildYear,
    },
    {
      value: (boat) => toFiniteNumber(boat.specs.loa),
      preference: "high",
      strength: copy.insights.longerLoa,
      watchout: copy.insights.smallerFootprint,
    },
    {
      value: (boat) => toFiniteNumber(boat.specs.draft),
      preference: "low",
      strength: copy.insights.shallowerDraft,
      watchout: copy.insights.deeperDraft,
    },
    {
      value: (boat) => scoreAccommodation(boat.specs.cabins, boat.specs.berths, boat.specs.heads),
      preference: "high",
      strength: copy.insights.strongerAccommodation,
      watchout: copy.insights.lighterAccommodation,
    },
    {
      value: (boat) => toFiniteNumber(boat.condition_score),
      preference: "high",
      strength: copy.insights.betterConditionSignal,
      watchout: copy.insights.weakerConditionSignal,
    },
  ];

  for (const signal of comparativeSignals) {
    const entries = boats
      .map((boat) => {
        const value = signal.value(boat);
        return value !== null && Number.isFinite(value) ? { boat, value } : null;
      })
      .filter((entry): entry is { boat: CompareBoat; value: number } => entry !== null);

    if (entries.length < 2) {
      continue;
    }

    const sorted = [...entries].sort((a, b) =>
      signal.preference === "low" ? a.value - b.value : b.value - a.value
    );

    if (sorted[0].value === sorted[1].value) {
      continue;
    }

    addInsight(insights, sorted[0].boat.id, "strengths", signal.strength);
    addInsight(insights, sorted[sorted.length - 1].boat.id, "watchouts", signal.watchout);
  }

  for (const boat of boats) {
    if (!boat.source_url) {
      addInsight(insights, boat.id, "strengths", copy.insights.directListing);
    } else {
      addInsight(insights, boat.id, "watchouts", copy.insights.importedListing);
    }

    if (!boat.location_text) {
      addInsight(insights, boat.id, "watchouts", copy.insights.locationRefining);
    }

    if (countFilledSpecs(boat) < 4) {
      addInsight(insights, boat.id, "watchouts", copy.insights.thinSpecs);
    }
  }

  for (const [boatId, value] of insights.entries()) {
    insights.set(boatId, {
      strengths: value.strengths.slice(0, 2),
      watchouts: value.watchouts.slice(0, 2),
    });
  }

  return insights;
}

export function buildBestFitSignals(
  boat: CompareBoat,
  copy: CompareAnalysisCopy = DEFAULT_COMPARE_ANALYSIS_COPY
): BestFitSignal[] {
  const fits: BestFitSignal[] = [];
  const tags = new Set(boat.character_tags.map((tag) => tag.toLowerCase()));
  const loa = toFiniteNumber(boat.specs.loa);
  const draft = toFiniteNumber(boat.specs.draft);
  const cabins = toFiniteNumber(boat.specs.cabins);
  const berths = toFiniteNumber(boat.specs.berths);
  const heads = toFiniteNumber(boat.specs.heads);
  const condition = toFiniteNumber(boat.condition_score);
  const imageCount = toFiniteNumber(boat.image_count);
  const pricePerFoot = getPricePerFootUsd(boat);

  if (tags.has("bluewater") || (loa !== null && loa >= 45)) {
    fits.push({
      label: copy.bestFit.bluewater.label,
      reason:
        loa !== null && loa >= 45
          ? copy.bestFit.bluewater.lengthReason(formatFeet(loa))
          : copy.bestFit.bluewater.tagReason,
    });
  }

  if (tags.has("liveaboard-ready") || ((cabins ?? 0) >= 3 && (heads ?? 0) >= 2)) {
    fits.push({
      label: copy.bestFit.liveaboard.label,
      reason:
        (cabins ?? 0) >= 3
          ? copy.bestFit.liveaboard.cabinsReason(formatCount(cabins), formatCount(heads))
          : copy.bestFit.liveaboard.tagReason,
    });
  }

  if (draft !== null && draft <= 4.5) {
    fits.push({
      label: copy.bestFit.shallowWater.label,
      reason: copy.bestFit.shallowWater.reason(formatFeet(draft)),
    });
  }

  if (tags.has("family-friendly") || (berths ?? 0) >= 6) {
    fits.push({
      label: copy.bestFit.familyCrew.label,
      reason:
        (berths ?? 0) >= 6
          ? copy.bestFit.familyCrew.berthsReason(formatCount(berths))
          : copy.bestFit.familyCrew.tagReason,
    });
  }

  if (!boat.source_url && condition !== null && condition >= 8 && (imageCount ?? 0) >= 6) {
    fits.push({
      label: copy.bestFit.fastFirstContact.label,
      reason: copy.bestFit.fastFirstContact.reason,
    });
  }

  if (pricePerFoot !== null && pricePerFoot <= 9000) {
    fits.push({
      label: copy.bestFit.valueFirst.label,
      reason: copy.bestFit.valueFirst.reason,
    });
  }

  return fits.slice(0, 2);
}

function createQuickFactor(input: {
  boats: CompareBoat[];
  label: string;
  numericPreference: NumericPreference;
  value: (boat: CompareBoat) => number | null;
  detail: (winner: CompareBoat, runnerUp: CompareBoat | null) => string;
}): QuickFactor | null {
  const entries = input.boats
    .map((boat) => {
      const value = input.value(boat);
      return value !== null && Number.isFinite(value) ? { boat, value } : null;
    })
    .filter((entry): entry is { boat: CompareBoat; value: number } => entry !== null);

  if (entries.length < 2) {
    return null;
  }

  const sorted = [...entries].sort((a, b) =>
    input.numericPreference === "low" ? a.value - b.value : b.value - a.value
  );

  if (sorted[0].value === sorted[1].value) {
    return null;
  }

  return {
    label: input.label,
    winnerId: sorted[0].boat.id,
    winnerTitle: formatBoatTitle(sorted[0].boat),
    detail: input.detail(sorted[0].boat, sorted[1]?.boat || null),
  };
}

function addInsight(
  insights: Map<string, BoatInsight>,
  boatId: string,
  key: keyof BoatInsight,
  value: string
) {
  const existing = insights.get(boatId);
  if (!existing) {
    return;
  }

  if (!existing[key].includes(value)) {
    existing[key].push(value);
  }
}

function countFilledSpecs(boat: CompareBoat) {
  const trackedSpecs = [
    boat.specs.loa,
    boat.specs.beam,
    boat.specs.draft,
    boat.specs.rig_type,
    sanitizeHullMaterial(boat.specs.hull_material),
    boat.specs.engine,
    boat.specs.cabins,
    boat.specs.berths,
    boat.specs.heads,
  ];

  return trackedSpecs.filter((value) => {
    if (typeof value === "number") {
      return Number.isFinite(value);
    }

    return typeof value === "string" && value.trim().length > 0;
  }).length;
}

function scoreAccommodation(cabins: unknown, berths: unknown, heads: unknown) {
  const cabinValue = toFiniteNumber(cabins);
  const berthValue = toFiniteNumber(berths);
  const headValue = toFiniteNumber(heads);
  if (cabinValue === null && berthValue === null && headValue === null) {
    return null;
  }

  return (cabinValue ?? 0) * 100 + (berthValue ?? 0) * 10 + (headValue ?? 0);
}

function getActionScore(boat: CompareBoat) {
  let score = 0;

  if (!boat.source_url) {
    score += 25;
  }

  if (boat.location_text) {
    score += 12;
  }

  score += Math.min(toFiniteNumber(boat.condition_score) ?? 5, 10) * 4;
  score += Math.min(toFiniteNumber(boat.image_count) ?? 0, 10);
  score += Math.min(countFilledSpecs(boat), 8) * 2;

  return score;
}
