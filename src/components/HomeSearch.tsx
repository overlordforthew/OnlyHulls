"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RIG_TYPES = [
  { value: "", label: "All Rig Types" },
  { value: "sloop", label: "Sloop" },
  { value: "cutter", label: "Cutter" },
  { value: "ketch", label: "Ketch" },
  { value: "yawl", label: "Yawl" },
  { value: "schooner", label: "Schooner" },
];

const PRICE_RANGES = [
  { value: "", label: "All Price Ranges" },
  { value: "0-25000", label: "Under $25,000" },
  { value: "25000-50000", label: "$25,000 – $50,000" },
  { value: "50000-100000", label: "$50,000 – $100,000" },
  { value: "100000-250000", label: "$100,000 – $250,000" },
  { value: "250000-", label: "$250,000+" },
];

const YEAR_RANGES = [
  { value: "", label: "Any Year" },
  { value: "2020", label: "2020 or newer" },
  { value: "2010", label: "2010 or newer" },
  { value: "2000", label: "2000 or newer" },
  { value: "1990", label: "1990 or newer" },
  { value: "1980", label: "1980 or newer" },
];

export default function HomeSearch() {
  const router = useRouter();
  const [makeModel, setMakeModel] = useState("");
  const [rigType, setRigType] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [minYear, setMinYear] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (makeModel.trim()) params.set("q", makeModel.trim());
    if (rigType) params.set("rigType", rigType);
    if (priceRange) {
      const [min, max] = priceRange.split("-");
      if (min) params.set("minPrice", min);
      if (max) params.set("maxPrice", max);
    }
    if (minYear) params.set("minYear", minYear);
    router.push(`/boats?${params.toString()}`);
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Boats for Sale</h2>
        <a
          href="/boats"
          className="text-sm font-medium text-primary hover:text-primary-light"
        >
          View All
        </a>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Rig Type
          </label>
          <select
            value={rigType}
            onChange={(e) => setRigType(e.target.value)}
            className={inputClass}
          >
            {RIG_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Price
          </label>
          <select
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value)}
            className={inputClass}
          >
            {PRICE_RANGES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Make or Model
          </label>
          <input
            type="text"
            value={makeModel}
            onChange={(e) => setMakeModel(e.target.value)}
            placeholder="Search Make or Model..."
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Year
          </label>
          <select
            value={minYear}
            onChange={(e) => setMinYear(e.target.value)}
            className={inputClass}
          >
            {YEAR_RANGES.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="mt-4 w-full rounded-lg bg-accent py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light"
      >
        Search
      </button>
      <div className="mt-2 text-center">
        <a
          href="/boats"
          className="text-xs text-primary/70 hover:text-primary"
        >
          Advanced Search
        </a>
      </div>
    </form>
  );
}
