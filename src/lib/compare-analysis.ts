import {
  convertCurrencyToUsd,
  convertUsdToCurrency,
  formatCurrencyAmount,
  type SupportedCurrency,
} from "@/lib/currency";

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

export function formatKilograms(value: unknown) {
  const kilograms = toFiniteNumber(value);
  return kilograms !== null ? `${Math.round(kilograms).toLocaleString("en-US")} kg` : "—";
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

export function formatPricePerFoot(boat: CompareBoat, currency: SupportedCurrency) {
  const amountUsd = getPricePerFootUsd(boat);
  if (amountUsd === null) {
    return "—";
  }

  return `${formatPriceFromUsd(amountUsd, currency)}/ft`;
}

export function getListingPathLabel(boat: CompareBoat) {
  if (boat.source_url) {
    return `Imported via ${formatSourceSite(boat.source_site)}`;
  }

  if (
    boat.seller_subscription_tier === "featured" ||
    boat.seller_subscription_tier === "broker"
  ) {
    return "Direct featured listing";
  }

  return "Direct OnlyHulls listing";
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

export function buildQuickFactors(boats: CompareBoat[], currency: SupportedCurrency): QuickFactor[] {
  const factors = [
    createQuickFactor({
      boats,
      label: "Lowest buy-in",
      numericPreference: "low",
      value: getBoatPriceUsd,
      detail: (winner, runnerUp) => {
        if (!runnerUp) {
          return `${formatPriceFromUsd(getBoatPriceUsd(winner), currency)} gets you into this compare set first.`;
        }

        const savings = Math.abs(getBoatPriceUsd(runnerUp) - getBoatPriceUsd(winner));
        return `${formatPriceFromUsd(savings, currency)} less than ${formatBoatTitle(runnerUp)}.`;
      },
    }),
    createQuickFactor({
      boats,
      label: "Price per foot edge",
      numericPreference: "low",
      value: getPricePerFootUsd,
      detail: (winner) => `${formatPricePerFoot(winner, currency)} based on current asking price and LOA.`,
    }),
    createQuickFactor({
      boats,
      label: "Newest build",
      numericPreference: "high",
      value: (boat) => boat.year,
      detail: (winner, runnerUp) => {
        if (!runnerUp) {
          return `${winner.year} is the newest build in this compare set.`;
        }

        return `${winner.year - runnerUp.year} years newer than ${formatBoatTitle(runnerUp)}.`;
      },
    }),
    createQuickFactor({
      boats,
      label: "Longest hull",
      numericPreference: "high",
      value: (boat) => toFiniteNumber(boat.specs.loa),
      detail: (winner, runnerUp) => {
        if (!runnerUp || toFiniteNumber(runnerUp.specs.loa) === null) {
          return `${formatFeet(winner.specs.loa)} overall length.`;
        }

        const advantage = (winner.specs.loa as number) - (runnerUp.specs.loa as number);
        return `${formatFeet(winner.specs.loa)} LOA, about ${advantage.toFixed(1)}ft longer than ${formatBoatTitle(runnerUp)}.`;
      },
    }),
    createQuickFactor({
      boats,
      label: "Shallower draft",
      numericPreference: "low",
      value: (boat) => toFiniteNumber(boat.specs.draft),
      detail: (winner, runnerUp) => {
        if (!runnerUp || toFiniteNumber(runnerUp.specs.draft) === null) {
          return `${formatFeet(winner.specs.draft)} draft.`;
        }

        const margin = (runnerUp.specs.draft as number) - (winner.specs.draft as number);
        return `${formatFeet(winner.specs.draft)} draft, roughly ${margin.toFixed(1)}ft shallower than ${formatBoatTitle(runnerUp)}.`;
      },
    }),
    createQuickFactor({
      boats,
      label: "Accommodation edge",
      numericPreference: "high",
      value: (boat) =>
        scoreAccommodation(boat.specs.cabins, boat.specs.berths, boat.specs.heads),
      detail: (winner) =>
        [
          toFiniteNumber(winner.specs.cabins) ? `${winner.specs.cabins} cabins` : null,
          toFiniteNumber(winner.specs.berths) ? `${winner.specs.berths} berths` : null,
          toFiniteNumber(winner.specs.heads) ? `${winner.specs.heads} heads` : null,
        ]
          .filter(Boolean)
          .join(" / "),
    }),
  ].filter((factor): factor is QuickFactor => factor !== null);

  return factors.slice(0, 4);
}

export function buildActionRecommendation(
  boats: CompareBoat[],
  currency: SupportedCurrency
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
    !winner.boat.source_url ? "direct OnlyHulls path" : "cleanest imported listing path",
    winner.boat.condition_score ? `condition ${Math.round(winner.boat.condition_score)}/10` : null,
    winner.boat.image_count ? `${winner.boat.image_count} images` : null,
    winner.boat.location_text ? "specific location shown" : null,
    getPricePerFootUsd(winner.boat) !== null
      ? `${formatPricePerFoot(winner.boat, currency)}`
      : null,
  ].filter(Boolean);

  return {
    winnerId: winner.boat.id,
    winnerTitle: formatBoatTitle(winner.boat),
    detail: `Best first call if you want the cleaner path first: ${reasons.slice(0, 3).join(", ")}.`,
  };
}

export function buildBoatInsights(boats: CompareBoat[]) {
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
      strength: "Lowest buy-in in this compare",
      watchout: "Highest asking price in this compare",
    },
    {
      value: getPricePerFootUsd,
      preference: "low",
      strength: "Lower price per foot",
      watchout: "Higher price per foot",
    },
    {
      value: (boat) => boat.year,
      preference: "high",
      strength: "Newest build year here",
      watchout: "Oldest build year here",
    },
    {
      value: (boat) => toFiniteNumber(boat.specs.loa),
      preference: "high",
      strength: "Longer LOA in this shortlist",
      watchout: "Smaller overall footprint",
    },
    {
      value: (boat) => toFiniteNumber(boat.specs.draft),
      preference: "low",
      strength: "Shallower draft",
      watchout: "Deeper draft to account for",
    },
    {
      value: (boat) => scoreAccommodation(boat.specs.cabins, boat.specs.berths, boat.specs.heads),
      preference: "high",
      strength: "Stronger accommodation layout",
      watchout: "Lighter accommodation spec sheet",
    },
    {
      value: (boat) => toFiniteNumber(boat.condition_score),
      preference: "high",
      strength: "Better condition signal",
      watchout: "Weaker condition signal",
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
      addInsight(insights, boat.id, "strengths", "Direct listing inside OnlyHulls");
    } else {
      addInsight(insights, boat.id, "watchouts", "Imported listing; confirm the source details before acting");
    }

    if (!boat.location_text) {
      addInsight(insights, boat.id, "watchouts", "Location still being refined");
    }

    if (countFilledSpecs(boat) < 4) {
      addInsight(insights, boat.id, "watchouts", "Thin spec sheet for a clean decision");
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

export function buildBestFitSignals(boat: CompareBoat): BestFitSignal[] {
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
      label: "Bluewater cruising",
      reason:
        loa !== null && loa >= 45
          ? `${formatFeet(loa)} overall length gives it a stronger offshore posture.`
          : "Its bluewater tags make it a more natural offshore shortlist candidate.",
    });
  }

  if (tags.has("liveaboard-ready") || ((cabins ?? 0) >= 3 && (heads ?? 0) >= 2)) {
    fits.push({
      label: "Liveaboard setup",
      reason:
        (cabins ?? 0) >= 3
          ? `${formatCount(cabins)} cabins and ${formatCount(heads)} heads support longer stays aboard.`
          : "The liveaboard-ready signals point to an easier onboard setup.",
    });
  }

  if (draft !== null && draft <= 4.5) {
    fits.push({
      label: "Shallow-water cruising",
      reason: `${formatFeet(draft)} draft opens up thinner anchorages and coastal routes.`,
    });
  }

  if (tags.has("family-friendly") || (berths ?? 0) >= 6) {
    fits.push({
      label: "Family crew",
      reason:
        (berths ?? 0) >= 6
          ? `${formatCount(berths)} berths give a family or guest crew more sleeping flexibility.`
          : "Family-friendly signals suggest an easier cruising setup with guests aboard.",
    });
  }

  if (!boat.source_url && condition !== null && condition >= 8 && (imageCount ?? 0) >= 6) {
    fits.push({
      label: "Fast first contact",
      reason: "Direct listing, strong condition signal, and healthy photo depth make this easier to act on.",
    });
  }

  if (pricePerFoot !== null && pricePerFoot <= 9000) {
    fits.push({
      label: "Value-first shortlist",
      reason: "The current price per foot keeps this one in the stronger value conversation.",
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
    boat.specs.hull_material,
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
