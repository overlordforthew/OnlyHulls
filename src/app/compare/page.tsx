"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ExternalLink,
  GitCompareArrows,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import CurrencySelector from "@/components/CurrencySelector";
import { useCompareBoats } from "@/hooks/useCompareBoats";
import {
  convertCurrencyToUsd,
  convertUsdToCurrency,
  formatCurrencyAmount,
  getDisplayedPrice,
  readPreferredCurrencyFromBrowser,
  type SupportedCurrency,
} from "@/lib/currency";
import { isLocalMediaUrl } from "@/lib/media";

interface CompareSpecs {
  loa?: number;
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

interface CompareBoat {
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

type NumericPreference = "high" | "low";

interface CompareRow {
  label: string;
  helper?: string;
  render: (boat: CompareBoat, displayCurrency: SupportedCurrency) => ReactNode;
  numericValue?: (boat: CompareBoat) => number | null;
  numericPreference?: NumericPreference;
}

interface CompareSection {
  title: string;
  subtitle: string;
  rows: CompareRow[];
}

interface QuickFactor {
  label: string;
  winnerId: string;
  winnerTitle: string;
  detail: string;
}

interface BoatInsight {
  strengths: string[];
  watchouts: string[];
}

const CURRENT_YEAR = 2026;

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

const compareSections: CompareSection[] = [
  {
    title: "Money",
    subtitle: "This is where budget fit and value separate fast.",
    rows: [
      {
        label: "Asking price",
        render: (boat, displayCurrency) =>
          getDisplayedPrice({
            amount: boat.asking_price,
            nativeCurrency: boat.currency,
            amountUsd: boat.asking_price_usd,
            preferredCurrency: displayCurrency,
          }).primary,
        numericValue: getBoatPriceUsd,
        numericPreference: "low",
      },
      {
        label: "Price per foot",
        helper: "Uses displayed currency and LOA when available.",
        render: (boat, displayCurrency) => formatPricePerFoot(boat, displayCurrency),
        numericValue: getPricePerFootUsd,
        numericPreference: "low",
      },
      {
        label: "Model year",
        render: (boat) => String(boat.year),
        numericValue: (boat) => boat.year,
        numericPreference: "high",
      },
      {
        label: "Approx. age",
        render: (boat) => `${Math.max(CURRENT_YEAR - boat.year, 0)} yrs`,
        numericValue: (boat) => CURRENT_YEAR - boat.year,
        numericPreference: "low",
      },
    ],
  },
  {
    title: "Boat & handling",
    subtitle: "Hull size, beam, and draft are usually the first hard filters.",
    rows: [
      {
        label: "Length overall",
        render: (boat) => formatFeet(boat.specs.loa),
        numericValue: (boat) => toFiniteNumber(boat.specs.loa),
        numericPreference: "high",
      },
      {
        label: "Beam",
        render: (boat) => formatFeet(boat.specs.beam),
        numericValue: (boat) => toFiniteNumber(boat.specs.beam),
        numericPreference: "high",
      },
      {
        label: "Draft",
        render: (boat) => formatFeet(boat.specs.draft),
        numericValue: (boat) => toFiniteNumber(boat.specs.draft),
        numericPreference: "low",
      },
      {
        label: "Rig / boat type",
        render: (boat) => formatTextValue(boat.specs.rig_type),
      },
      {
        label: "Hull material",
        render: (boat) => formatTextValue(boat.specs.hull_material),
      },
      {
        label: "Keel",
        render: (boat) => formatTextValue(boat.specs.keel_type),
      },
    ],
  },
  {
    title: "Liveability & systems",
    subtitle: "Useful for deciding whether the boat fits how you will actually use it.",
    rows: [
      {
        label: "Cabins",
        render: (boat) => formatCount(boat.specs.cabins),
        numericValue: (boat) => toFiniteNumber(boat.specs.cabins),
        numericPreference: "high",
      },
      {
        label: "Berths",
        render: (boat) => formatCount(boat.specs.berths),
        numericValue: (boat) => toFiniteNumber(boat.specs.berths),
        numericPreference: "high",
      },
      {
        label: "Heads",
        render: (boat) => formatCount(boat.specs.heads),
        numericValue: (boat) => toFiniteNumber(boat.specs.heads),
        numericPreference: "high",
      },
      {
        label: "Engine",
        render: (boat) => formatTextValue(boat.specs.engine),
      },
      {
        label: "Fuel",
        render: (boat) => formatTextValue(boat.specs.fuel_type),
      },
      {
        label: "Displacement",
        render: (boat) => formatKilograms(boat.specs.displacement),
        numericValue: (boat) => toFiniteNumber(boat.specs.displacement),
        numericPreference: "low",
      },
    ],
  },
  {
    title: "Listing context",
    subtitle: "These signals help a buyer judge trust, freshness, and how direct the path is.",
    rows: [
      {
        label: "Location",
        render: (boat) => formatTextValue(boat.location_text, "Location being refined"),
      },
      {
        label: "Listing path",
        render: (boat) => getListingPathLabel(boat),
      },
      {
        label: "Condition signal",
        render: (boat) =>
          boat.condition_score
            ? `${Math.round(boat.condition_score)}/10`
            : "Not scored yet",
        numericValue: (boat) => toFiniteNumber(boat.condition_score),
        numericPreference: "high",
      },
      {
        label: "Photos on file",
        render: (boat) =>
          boat.image_count && boat.image_count > 0
            ? `${boat.image_count} image${boat.image_count === 1 ? "" : "s"}`
            : "Photo count still syncing",
        numericValue: (boat) => toFiniteNumber(boat.image_count),
        numericPreference: "high",
      },
      {
        label: "Character tags",
        render: (boat) =>
          boat.character_tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {boat.character_tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            "Not tagged yet"
          ),
      },
    ],
  },
];

export default function ComparePage() {
  const { compareIds, compareCount, clear, removeBoat, maxCompareBoats } = useCompareBoats();
  const [boats, setBoats] = useState<CompareBoat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>(() =>
    readPreferredCurrencyFromBrowser()
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (compareIds.length === 0) {
        setBoats([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/boats/compare?ids=${encodeURIComponent(compareIds.join(","))}`);
        if (!res.ok) throw new Error("Failed to load comparison.");
        const data = await res.json();
        if (!cancelled) {
          setBoats(data.boats || []);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load the compare view right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [compareIds]);

  const missingCount = useMemo(
    () => Math.max(compareCount - boats.length, 0),
    [boats.length, compareCount]
  );

  const comparisonGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `260px repeat(${Math.max(boats.length, 1)}, minmax(280px, 1fr))`,
    }),
    [boats.length]
  );

  const quickFactors = useMemo(
    () => buildQuickFactors(boats, displayCurrency),
    [boats, displayCurrency]
  );

  const boatInsights = useMemo(() => buildBoatInsights(boats), [boats]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <GitCompareArrows className="h-3.5 w-3.5" />
            Compare Boats
          </div>
          <h1 className="mt-4 text-3xl font-bold">Side-by-side boat comparison</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Compare up to {maxCompareBoats} boats on the factors that actually change a buying decision:
            price, size, draft, layout, and listing trust.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CurrencySelector
            id="compare-currency"
            value={displayCurrency}
            onChange={setDisplayCurrency}
          />
          <button
            type="button"
            onClick={clear}
            disabled={compareCount === 0}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Clear compare
          </button>
        </div>
      </div>

      {compareCount === 0 ? (
        <EmptyState />
      ) : loading ? (
        <div className="mt-10 text-sm text-text-secondary">Loading comparison...</div>
      ) : error ? (
        <div className="mt-10 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <>
          {missingCount > 0 && (
            <div className="mt-6 rounded-2xl border border-accent/20 bg-accent/10 px-5 py-4 text-sm text-foreground/80">
              {missingCount} selected boat{missingCount === 1 ? "" : "s"} could not be compared because the listing is no longer public.
            </div>
          )}

          {boats.length < 2 && (
            <div className="mt-6 rounded-2xl border border-border bg-surface px-5 py-4 text-sm text-text-secondary">
              Add one more boat from browse or matches so the side-by-side view can surface real tradeoffs.
            </div>
          )}

          {boats.length > 0 && (
            <div className="mt-8 overflow-x-auto pb-2">
              <div className="grid min-w-[1140px] gap-4" style={comparisonGridStyle}>
                <QuickReadRail factors={quickFactors} />
                {boats.map((boat) => (
                  <CompareBoatPanel
                    key={boat.id}
                    boat={boat}
                    displayCurrency={displayCurrency}
                    insight={boatInsights.get(boat.id) || { strengths: [], watchouts: [] }}
                    onRemove={() => removeBoat(boat.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {boats.length > 0 && (
            <div className="mt-10 overflow-x-auto">
              <div className="min-w-[1140px] overflow-hidden rounded-3xl border border-border bg-surface">
                <div
                  className="grid border-b border-border bg-background/40"
                  style={comparisonGridStyle}
                >
                  <div className="px-5 py-4">
                    <p
                      className="text-xs font-semibold uppercase tracking-[0.22em] text-text-tertiary"
                      data-testid="compare-factor-heading"
                    >
                      Compare factors
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Start with money and draft, then use the rows below to compare layout and trust.
                    </p>
                  </div>
                  {boats.map((boat) => (
                    <div key={boat.id} className="border-l border-border px-5 py-4">
                      <Link
                        href={`/boats/${boat.slug || boat.id}`}
                        className="font-semibold text-foreground transition-colors hover:text-primary"
                      >
                        {formatBoatTitle(boat)}
                      </Link>
                      <p className="mt-1 text-sm text-text-secondary">
                        {boat.location_text || "Location being refined"}
                      </p>
                    </div>
                  ))}
                </div>

                {compareSections.map((section) => (
                  <Fragment key={section.title}>
                    <div
                      className="grid border-b border-border bg-background/20"
                      style={comparisonGridStyle}
                    >
                      <div className="px-5 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                          {section.title}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">{section.subtitle}</p>
                      </div>
                      {boats.map((boat) => (
                        <div key={`${section.title}-${boat.id}`} className="border-l border-border" />
                      ))}
                    </div>

                    {section.rows.map((row) => {
                      const winnerIds = getWinningBoatIds(row, boats);
                      return (
                        <div
                          key={`${section.title}-${row.label}`}
                          className="grid text-sm"
                          style={comparisonGridStyle}
                        >
                          <div className="border-b border-border px-5 py-4">
                            <p className="font-medium text-foreground/85">{row.label}</p>
                            {row.helper ? (
                              <p className="mt-1 text-xs text-text-tertiary">{row.helper}</p>
                            ) : null}
                          </div>
                          {boats.map((boat) => {
                            const isWinner = winnerIds.has(boat.id);
                            return (
                              <div
                                key={`${boat.id}-${row.label}`}
                                className={`border-b border-l border-border px-5 py-4 ${
                                  isWinner
                                    ? "bg-primary/10 text-primary"
                                    : "text-foreground/85"
                                }`}
                              >
                                {row.render(boat, displayCurrency)}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/boats"
              className="inline-flex items-center gap-2 rounded-full bg-primary-btn px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-light"
            >
              Add more boats
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function QuickReadRail({ factors }: { factors: QuickFactor[] }) {
  return (
    <aside
      className="rounded-3xl border border-primary/15 bg-gradient-to-b from-primary/12 via-surface to-surface p-5"
      data-testid="compare-quick-read"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Quick read
      </div>
      <h2 className="mt-4 text-xl font-semibold text-foreground">Where the shortlist really separates</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        These are the clearest decision edges in the current compare set.
      </p>

      <div className="mt-5 space-y-3">
        {factors.length > 0 ? (
          factors.map((factor) => (
            <div key={factor.label} className="rounded-2xl border border-border bg-background/45 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                {factor.label}
              </p>
              <p className="mt-2 font-medium text-foreground">{factor.winnerTitle}</p>
              <p className="mt-1 text-sm text-text-secondary">{factor.detail}</p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-border bg-background/45 p-4 text-sm text-text-secondary">
            Add a couple of well-specified boats and this panel will call out the biggest differences immediately.
          </div>
        )}
      </div>

      <p className="mt-5 text-xs leading-5 text-text-tertiary">
        Then use the matrix below for the exact numbers, layout details, and listing trust cues.
      </p>
    </aside>
  );
}

function CompareBoatPanel({
  boat,
  displayCurrency,
  insight,
  onRemove,
}: {
  boat: CompareBoat;
  displayCurrency: SupportedCurrency;
  insight: BoatInsight;
  onRemove: () => void;
}) {
  const href = `/boats/${boat.slug || boat.id}`;
  const displayedPrice = getDisplayedPrice({
    amount: boat.asking_price,
    nativeCurrency: boat.currency,
    amountUsd: boat.asking_price_usd,
    preferredCurrency: displayCurrency,
  });
  const headlineMetrics = [
    { label: "Ask", value: displayedPrice.primary },
    { label: "Price / ft", value: formatPricePerFoot(boat, displayCurrency) },
    { label: "Length", value: formatFeet(boat.specs.loa) },
    { label: "Draft", value: formatFeet(boat.specs.draft) },
  ];

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface">
      <Link href={href} className="group relative block aspect-[4/3] overflow-hidden bg-muted">
        {boat.hero_url ? (
          <Image
            src={boat.hero_url}
            alt={formatBoatTitle(boat)}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 1200px) 320px, 25vw"
            unoptimized={!isLocalMediaUrl(boat.hero_url)}
            quality={isLocalMediaUrl(boat.hero_url) ? 82 : undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface-elevated text-sm text-text-secondary">
            Photo unavailable
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-white drop-shadow-lg">{displayedPrice.primary}</p>
            {displayedPrice.secondary ? (
              <p className="mt-1 text-xs text-white/70 drop-shadow-lg">{displayedPrice.secondary}</p>
            ) : null}
          </div>
          <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {getListingPathLabel(boat)}
          </span>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              href={href}
              className="text-xl font-semibold text-foreground transition-colors hover:text-primary"
            >
              {formatBoatTitle(boat)}
            </Link>
            <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{boat.location_text || "Location being refined"}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-primary hover:text-primary"
            aria-label={`Remove ${formatBoatTitle(boat)} from compare`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {headlineMetrics.map((metric) => (
            <CompareMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <InsightBlock title="Why it stands out" tone="positive" items={insight.strengths} />
          <InsightBlock title="Watchouts" tone="neutral" items={insight.watchouts} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          {boat.condition_score ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Condition {Math.round(boat.condition_score)}/10
            </span>
          ) : null}
          {boat.image_count && boat.image_count > 0 ? (
            <span className="rounded-full border border-border px-2.5 py-1 text-text-secondary">
              {boat.image_count} image{boat.image_count === 1 ? "" : "s"}
            </span>
          ) : null}
          {boat.character_tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-full bg-primary-btn px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
          >
            Open listing
            <ArrowRight className="h-4 w-4" />
          </Link>
          {boat.source_url ? (
            <a
              href={boat.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
            >
              Original source
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CompareMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/45 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function InsightBlock({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "positive" | "neutral";
  items: string[];
}) {
  const toneClass =
    tone === "positive"
      ? "border-primary/20 bg-primary/10 text-primary"
      : "border-border bg-background/45 text-text-secondary";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
        {title}
      </p>
      <div className="mt-2 space-y-2 text-sm">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item} className="flex items-start gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-current" />
              <span>{item}</span>
            </div>
          ))
        ) : (
          <p>No strong separator surfaced yet.</p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-border px-8 py-16 text-center">
      <p className="text-lg font-semibold">No boats in compare yet</p>
      <p className="mt-2 text-sm text-text-secondary">
        Use the Compare button on browse cards or in your matches to build a shortlist worth deciding between.
      </p>
      <Link
        href="/boats"
        className="mt-6 inline-flex rounded-full bg-primary-btn px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-light"
      >
        Start browsing
      </Link>
    </div>
  );
}

function formatBoatTitle(boat: Pick<CompareBoat, "year" | "make" | "model">) {
  return `${boat.year} ${boat.make} ${boat.model}`.replace(/\s+/g, " ").trim();
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatTextValue(value: string | null | undefined, fallback = "—") {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function formatCount(value: unknown) {
  const count = toFiniteNumber(value);
  return count !== null ? String(count) : "—";
}

function formatFeet(value: unknown) {
  const feet = toFiniteNumber(value);
  return feet !== null ? `${feet}ft` : "—";
}

function formatKilograms(value: unknown) {
  const kilograms = toFiniteNumber(value);
  return kilograms !== null ? `${Math.round(kilograms).toLocaleString("en-US")} kg` : "—";
}

function getBoatPriceUsd(boat: CompareBoat) {
  if (toFiniteNumber(boat.asking_price_usd) !== null) {
    return boat.asking_price_usd as number;
  }

  if (boat.currency === "USD") {
    return boat.asking_price;
  }

  return convertCurrencyToUsd(boat.asking_price, boat.currency as SupportedCurrency);
}

function getPricePerFootUsd(boat: CompareBoat) {
  const loa = toFiniteNumber(boat.specs.loa);
  if (!loa || loa <= 0) {
    return null;
  }

  return getBoatPriceUsd(boat) / loa;
}

function formatPriceFromUsd(amountUsd: number, currency: SupportedCurrency) {
  return formatCurrencyAmount(convertUsdToCurrency(amountUsd, currency), currency);
}

function formatPricePerFoot(boat: CompareBoat, currency: SupportedCurrency) {
  const amountUsd = getPricePerFootUsd(boat);
  if (amountUsd === null) {
    return "—";
  }

  return `${formatPriceFromUsd(amountUsd, currency)}/ft`;
}

function getListingPathLabel(boat: CompareBoat) {
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

function formatSourceSite(source: string | null | undefined) {
  if (!source) {
    return "partner";
  }

  return SOURCE_NAMES[source] || source.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getWinningBoatIds(row: CompareRow, boats: CompareBoat[]) {
  if (!row.numericValue || !row.numericPreference) {
    return new Set<string>();
  }

  const entries = boats
    .map((boat) => {
      const value = row.numericValue?.(boat);
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
    row.numericPreference === "low"
      ? Math.min(...entries.map((entry) => entry.value))
      : Math.max(...entries.map((entry) => entry.value));

  return new Set(entries.filter((entry) => entry.value === target).map((entry) => entry.id));
}

function buildQuickFactors(boats: CompareBoat[], currency: SupportedCurrency): QuickFactor[] {
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

function buildBoatInsights(boats: CompareBoat[]) {
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
