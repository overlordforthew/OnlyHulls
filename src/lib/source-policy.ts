export type SourceDecisionStatus = "keep" | "test" | "hold";
export type DailySourceDecisionStatus = SourceDecisionStatus | "undecided";

export type SourceDecision = {
  status: SourceDecisionStatus;
  sourceName: string;
  reason: string;
};

export type DailySourceDecision = {
  run: boolean;
  status: DailySourceDecisionStatus;
  sourceName: string;
  reason: string;
};

const SOURCE_DECISIONS_BY_KEY: Record<string, SourceDecision> = {
  sailboatlistings: {
    status: "keep",
    sourceName: "Sailboat Listings",
    reason:
      "Keep in the daily portfolio; production source health on 2026-04-15 showed 9,017 visible listings out of 9,851 active rows after the stale-detail recovery and duplicate cleanup work, still making it the largest buyer-visible sailing source.",
  },
  theyachtmarket: {
    status: "keep",
    sourceName: "TheYachtMarket",
    reason:
      "Keep in the daily portfolio; production source health on 2026-04-14 showed 3,522 visible listings out of 3,665 active rows with strong sailing relevance.",
  },
  dreamyacht: {
    status: "keep",
    sourceName: "Dream Yacht Sales",
    reason:
      "Keep in the daily portfolio; production source health on 2026-04-14 showed 95 visible listings out of 97 active rows after the recent image and location recovery work.",
  },
  catamaransite: {
    status: "keep",
    sourceName: "CatamaranSite",
    reason:
      "Keep in the daily portfolio; production source health on 2026-04-14 showed all 44 active CatamaranSite rows buyer-visible.",
  },
  moorings: {
    status: "keep",
    sourceName: "Moorings Brokerage",
    reason:
      "Keep in the daily portfolio; production source health on 2026-04-14 showed 13 visible listings out of 14 active rows for this high-fit charter-exit source.",
  },
  rightboat: {
    status: "test",
    sourceName: "Rightboat",
    reason:
      "Keep Rightboat in the controlled-test lane only; the operational source directory still flags aggressive rate limiting, and production currently has 0 active imported rows on 2026-04-15.",
  },
  boats_com: {
    status: "test",
    sourceName: "Boats.com",
    reason:
      "Keep Boats.com in the controlled-test lane only while we observe the residential-egress scraper variant; production source health on 2026-04-21 showed 71 active buyer-visible rows with 100% field fill across a 5-page sample, zero Cloudflare events. Promote after a week of daily runs at that quality level.",
  },
  apolloduck_us: {
    status: "hold",
    sourceName: "Apollo Duck US",
    reason:
      "Hold new imports until the scraper can capture real images and locations; production source health on 2026-04-15 showed 0 visible listings out of 89 active rows, with 87 missing locations and 89 missing images.",
  },
  camperandnicholsons: {
    status: "hold",
    sourceName: "Camper & Nicholsons",
    reason:
      "Hold new imports until the scraper follows detail pages for real location and image extraction; production source health on 2026-04-15 showed 0 visible listings out of 90 active rows, with all 90 missing locations and images.",
  },
  boote_yachten: {
    status: "hold",
    sourceName: "Boote & Yachten",
    reason:
      "Hold new imports until the scraper follows detail pages for real image extraction; production source health on 2026-04-14 showed 0 visible listings out of 23 active rows with all 23 missing images.",
  },
  denison: {
    status: "hold",
    sourceName: "Denison Yachting",
    reason:
      "Hold new imports until the scraper follows detail pages for real image and location extraction; production source health on 2026-04-15 showed 0 visible listings out of 21 active rows with all 21 missing locations and images.",
  },
  multihullcompany: {
    status: "hold",
    sourceName: "Multihull Company",
    reason:
      "Hold new imports until the scraper captures real images from listing or detail pages; production source health on 2026-04-15 showed 0 visible listings out of 17 active rows with all 17 missing images.",
  },
  vi_yachtbroker: {
    status: "hold",
    sourceName: "VI Yacht Broker",
    reason:
      "Hold new imports until the scraper follows detail pages for real image extraction; production source health on 2026-04-15 showed 0 visible listings out of 15 active rows with all 15 missing images.",
  },
  multihullworld: {
    status: "hold",
    sourceName: "Multihull World",
    reason:
      "Hold new imports until the scraper follows detail pages for real image and location extraction; production source health on 2026-04-15 showed 0 visible listings out of 14 active rows with all 14 missing locations and images.",
  },
  catamarans_com: {
    status: "hold",
    sourceName: "Catamarans.com",
    reason:
      "Hold new imports and suppress residual public visibility until location extraction, powerboat/RIB filtering, and source/model consistency improve; production review on 2026-04-18 showed 76 active rows, 8 pre-policy visible rows, 68 missing locations, 15 active used-power URLs, and 0 contact clicks in the last 30 days.",
  },
};

const SOURCE_DECISIONS_BY_NAME = new Map(
  Object.values(SOURCE_DECISIONS_BY_KEY).map((decision) => [decision.sourceName.toLowerCase(), decision])
);

export function getSourceDecisionByKey(sourceKey: string) {
  return SOURCE_DECISIONS_BY_KEY[sourceKey] ?? null;
}

export function getSourceDecisionEntries() {
  return Object.entries(SOURCE_DECISIONS_BY_KEY).map(([sourceKey, decision]) => ({
    sourceKey,
    ...decision,
  }));
}

export function getHeldSourceKeys() {
  return getSourceDecisionEntries()
    .filter((decision) => decision.status === "hold")
    .map((decision) => decision.sourceKey);
}

export function getHeldSourceNames() {
  return getSourceDecisionEntries()
    .filter((decision) => decision.status === "hold")
    .map((decision) => decision.sourceName);
}

export function getSourceDecisionByName(sourceName: string | null | undefined) {
  const normalized = String(sourceName || "").trim().toLowerCase();
  if (!normalized) return null;
  return SOURCE_DECISIONS_BY_NAME.get(normalized) ?? null;
}

export function getDailySourceDecision(sourceKey: string, fallbackSourceName?: string): DailySourceDecision {
  const decision = getSourceDecisionByKey(sourceKey);
  const sourceName = decision?.sourceName || fallbackSourceName || sourceKey;

  if (!decision) {
    return {
      run: false,
      status: "undecided",
      sourceName,
      reason:
        `${sourceName} is not in the daily portfolio yet; add an explicit source policy decision after a source-health review before scraping it in production.`,
    };
  }

  return {
    run: decision.status === "keep",
    status: decision.status,
    sourceName: decision.sourceName,
    reason: decision.reason,
  };
}

export function shouldRunSourceInDailyPortfolio(sourceKey: string) {
  return getDailySourceDecision(sourceKey).run;
}

export function assertSourceImportAllowed(sourceKey: string, sourceName: string) {
  const decision = getSourceDecisionByKey(sourceKey);
  if (decision?.status === "hold") {
    throw new Error(`${sourceName} imports are on hold: ${decision.reason}`);
  }
}
