"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, GitCompareArrows, Trash2 } from "lucide-react";
import BoatCard from "@/components/BoatCard";
import CurrencySelector from "@/components/CurrencySelector";
import { useCompareBoats } from "@/hooks/useCompareBoats";
import { getDisplayedPrice, readPreferredCurrencyFromBrowser, type SupportedCurrency } from "@/lib/currency";

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
  specs: { loa?: number; rig_type?: string };
  character_tags: string[];
  source_site?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  seller_subscription_tier?: string | null;
}

const compareRows: Array<{
  label: string;
  render: (boat: CompareBoat, displayCurrency: SupportedCurrency) => string;
}> = [
  {
    label: "Price",
    render: (boat, displayCurrency) =>
      getDisplayedPrice({
        amount: boat.asking_price,
        nativeCurrency: boat.currency,
        amountUsd: boat.asking_price_usd,
        preferredCurrency: displayCurrency,
      }).primary,
  },
  { label: "Year", render: (boat) => String(boat.year) },
  { label: "Location", render: (boat) => boat.location_text || "Unknown" },
  { label: "Length", render: (boat) => (boat.specs.loa ? `${boat.specs.loa}ft` : "Unknown") },
  { label: "Rig / Type", render: (boat) => boat.specs.rig_type || "Unknown" },
  {
    label: "Tags",
    render: (boat) => (boat.character_tags.length ? boat.character_tags.join(", ") : "None yet"),
  },
  { label: "Source", render: (boat) => boat.source_name || boat.source_site || "OnlyHulls" },
];

export default function ComparePage() {
  const { compareIds, compareCount, clear, removeBoat, isCompared, maxCompareBoats } =
    useCompareBoats();
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
            Keep this focused. Compare up to {maxCompareBoats} boats on the specs and signals that actually drive a decision.
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
              Add at least one more boat from browse or matches to make this view useful.
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {boats.map((boat) => (
              <BoatCard
                key={boat.id}
                boat={boat}
                displayCurrency={displayCurrency}
                onCompareToggle={() => removeBoat(boat.id)}
                compareSelected={isCompared(boat.id)}
              />
            ))}
          </div>

          {boats.length > 0 && (
            <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="grid border-b border-border bg-background/40 text-sm font-semibold text-foreground/80" style={{ gridTemplateColumns: `220px repeat(${boats.length}, minmax(0, 1fr))` }}>
                <div className="px-4 py-3">Decision signal</div>
                {boats.map((boat) => (
                  <div key={boat.id} className="border-l border-border px-4 py-3">
                    <Link href={`/boats/${boat.slug || boat.id}`} className="hover:text-primary">
                      {boat.year} {boat.make} {boat.model}
                    </Link>
                  </div>
                ))}
              </div>

              {compareRows.map((row) => (
                <div
                  key={row.label}
                  className="grid text-sm"
                  style={{ gridTemplateColumns: `220px repeat(${boats.length}, minmax(0, 1fr))` }}
                >
                  <div className="border-b border-border bg-background/20 px-4 py-3 font-medium text-foreground/70">
                    {row.label}
                  </div>
                  {boats.map((boat) => (
                    <div key={`${boat.id}-${row.label}`} className="border-b border-l border-border px-4 py-3 text-foreground/85">
                      {row.render(boat, displayCurrency)}
                    </div>
                  ))}
                </div>
              ))}
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

function EmptyState() {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-border px-8 py-16 text-center">
      <p className="text-lg font-semibold">No boats in compare yet</p>
      <p className="mt-2 text-sm text-text-secondary">
        Use the Compare button on browse cards or in your matches to build a shortlist worth discussing.
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
