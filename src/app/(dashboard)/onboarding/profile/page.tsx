"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sailboat,
  Home,
  Flag,
  Fish,
  Anchor,
  Globe,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
} from "lucide-react";
import CurrencySelector from "@/components/CurrencySelector";
import {
  convertUsdToCurrency,
  formatCurrencyAmount,
  readPreferredCurrencyFromBrowser,
  type SupportedCurrency,
} from "@/lib/currency";

const STEPS = [
  { title: "What's Your Dream?", subtitle: "How will you use your boat?" },
  { title: "What's Your Budget?", subtitle: "Choose the range that fits your real spend" },
  { title: "What Type of Boat?", subtitle: "Narrow down the hull" },
  { title: "Size & Specs", subtitle: "The details that matter" },
  { title: "Where Will You Sail?", subtitle: "Home port and cruising grounds" },
  { title: "Your Experience", subtitle: "So we can calibrate recommendations" },
  { title: "Your Timeline", subtitle: "When are you looking to buy?" },
];

const USE_CASES = [
  { value: "cruising", label: "Cruising", icon: Globe, desc: "Island-hopping, coastal, or offshore passages" },
  { value: "liveaboard", label: "Liveaboard", icon: Home, desc: "Your boat is your home" },
  { value: "racing", label: "Racing", icon: Flag, desc: "Club racing, regattas, or ocean races" },
  { value: "weekender", label: "Weekender", icon: Sailboat, desc: "Day sails and weekend getaways" },
  { value: "fishing", label: "Fishing", icon: Fish, desc: "Inshore or offshore fishing trips" },
  { value: "charter", label: "Charter", icon: Anchor, desc: "Running a charter business" },
];

const BUDGETS = [
  { value: "0-25000", minUsd: 0, maxUsd: 25000, desc: "Starter boats, project boats" },
  { value: "25000-75000", minUsd: 25000, maxUsd: 75000, desc: "Solid cruisers, older classics" },
  { value: "75000-150000", minUsd: 75000, maxUsd: 150000, desc: "Well-equipped bluewater boats" },
  { value: "150000-300000", minUsd: 150000, maxUsd: 300000, desc: "Premium cruisers, modern designs" },
  { value: "300000-500000", minUsd: 300000, maxUsd: 500000, desc: "Luxury yachts, performance cruisers" },
  { value: "500000+", minUsd: 500000, maxUsd: null, desc: "Top-tier, custom builds" },
];

const BOAT_TYPES = [
  { value: "monohull", label: "Monohull", desc: "Traditional single-hull sailboat" },
  { value: "catamaran", label: "Catamaran", desc: "Twin-hull, stable, spacious" },
  { value: "trimaran", label: "Trimaran", desc: "Three hulls, fast and light" },
  { value: "powerboat", label: "Powerboat", desc: "Motor yacht or cruiser" },
  { value: "no-preference", label: "No Preference", desc: "Show me everything" },
];

const RIG_TYPES = [
  { value: "sloop", label: "Sloop" },
  { value: "cutter", label: "Cutter" },
  { value: "ketch", label: "Ketch" },
  { value: "catboat", label: "Catboat" },
  { value: "schooner", label: "Schooner" },
  { value: "no-preference", label: "Any" },
];

const EXPERIENCE_LEVELS = [
  { value: "novice", label: "Novice", desc: "New to boating - eager to learn" },
  { value: "intermediate", label: "Intermediate", desc: "Some experience, can handle basics" },
  { value: "experienced", label: "Experienced", desc: "Comfortable offshore, thousands of miles" },
  { value: "professional", label: "Professional", desc: "Licensed captain or instructor" },
];

const TIMELINES = [
  { value: "browsing", label: "Just Browsing", desc: "No rush, exploring options" },
  { value: "3mo", label: "3 Months", desc: "Actively shopping" },
  { value: "6mo", label: "6 Months", desc: "Serious but flexible" },
  { value: "12mo", label: "12 Months", desc: "Planning ahead" },
  { value: "ready", label: "Ready Now", desc: "Found what I want, let's go" },
];

function formatBudgetLabel(minUsd: number, maxUsd: number | null, currency: SupportedCurrency) {
  const minAmount = minUsd > 0 ? Math.round(convertUsdToCurrency(minUsd, currency)) : 0;
  const maxAmount = maxUsd !== null ? Math.round(convertUsdToCurrency(maxUsd, currency)) : null;

  if (maxAmount === null) {
    return `${formatCurrencyAmount(minAmount, currency)}+`;
  }
  if (minAmount === 0) {
    return `Under ${formatCurrencyAmount(maxAmount, currency)}`;
  }
  return `${formatCurrencyAmount(minAmount, currency)} - ${formatCurrencyAmount(maxAmount, currency)}`;
}

export default function ProfileQuestionnaire() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [useCases, setUseCases] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState<SupportedCurrency>(() =>
    readPreferredCurrencyFromBrowser()
  );
  const [boatType, setBoatType] = useState("");
  const [rigType, setRigType] = useState("");
  const [loaMin, setLoaMin] = useState("");
  const [loaMax, setLoaMax] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [homePort, setHomePort] = useState("");
  const [regions, setRegions] = useState("");
  const [experience, setExperience] = useState("");
  const [timeline, setTimeline] = useState("");

  function toggleUseCase(value: string) {
    setUseCases((prev) => (prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value]));
  }

  function canAdvance(): boolean {
    switch (step) {
      case 0:
        return useCases.length > 0;
      case 1:
        return !!budget;
      case 2:
        return !!boatType;
      case 3:
      case 4:
        return true;
      case 5:
        return !!experience;
      case 6:
        return !!timeline;
      default:
        return false;
    }
  }

  async function handleFinish() {
    setSaving(true);

    const selectedBudget = BUDGETS.find((option) => option.value === budget);
    const budgetMinUsd = selectedBudget?.minUsd ?? 0;
    const budgetMaxUsd = selectedBudget?.maxUsd ?? 999_999_999;
    const budgetMin = Math.round(convertUsdToCurrency(budgetMinUsd, budgetCurrency));
    const budgetMax =
      selectedBudget?.maxUsd === null
        ? 999_999_999
        : Math.round(convertUsdToCurrency(budgetMaxUsd, budgetCurrency));

    const profile = {
      use_case: useCases,
      budget_range: {
        min: budgetMin,
        max: budgetMax,
        currency: budgetCurrency,
        min_usd: budgetMinUsd,
        max_usd: budgetMaxUsd,
        refit_budget: 0,
      },
      boat_type_prefs: {
        types: boatType === "no-preference" ? [] : [boatType],
        rig_prefs: rigType && rigType !== "no-preference" ? [rigType] : [],
        hull_prefs: [],
      },
      spec_preferences: {
        ...(loaMin && { loa_min: parseInt(loaMin, 10) }),
        ...(loaMax && { loa_max: parseInt(loaMax, 10) }),
        ...(yearMin && { year_min: parseInt(yearMin, 10) }),
      },
      location_prefs: {
        home_port: homePort,
        max_travel_km: 5000,
        regions: regions ? regions.split(",").map((region) => region.trim()) : [],
      },
      experience_level: experience,
      deal_breakers: [],
      timeline,
      refit_tolerance: "minor",
    };

    const rawCallback = searchParams.get("callbackUrl") || "";
    const callbackUrl = /^\/(?!\/)/.test(rawCallback) ? rawCallback : "";

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        router.push(callbackUrl || "/matches");
      } else {
        router.push(callbackUrl || "/boats");
      }
    } catch {
      router.push(callbackUrl || "/boats");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs text-text-secondary">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="text-2xl font-bold">{STEPS[step].title}</h1>
      <p className="mt-1 text-text-secondary">{STEPS[step].subtitle}</p>

      <div className="mt-8">
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {USE_CASES.map((useCase) => {
              const selected = useCases.includes(useCase.value);
              return (
                <button
                  key={useCase.value}
                  onClick={() => toggleUseCase(useCase.value)}
                  className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <useCase.icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      selected ? "text-primary" : "text-text-tertiary"
                    }`}
                  />
                  <div>
                    <p className="font-semibold">{useCase.label}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">{useCase.desc}</p>
                  </div>
                  {selected && <Check className="ml-auto h-5 w-5 shrink-0 text-primary" />}
                </button>
              );
            })}
            <p className="text-xs text-text-tertiary sm:col-span-2">
              Select one or more - many sailors have multiple goals.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <CurrencySelector
              id="budget-currency"
              value={budgetCurrency}
              onChange={setBudgetCurrency}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {BUDGETS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setBudget(option.value)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    budget === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="text-lg font-bold">
                    {formatBudgetLabel(option.minUsd, option.maxUsd, budgetCurrency)}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">{option.desc}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-text-tertiary">
              We compare budgets in USD underneath, but you can choose the currency that feels natural.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {BOAT_TYPES.map((boatOption) => (
                <button
                  key={boatOption.value}
                  onClick={() => setBoatType(boatOption.value)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    boatType === boatOption.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="font-semibold">{boatOption.label}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{boatOption.desc}</p>
                </button>
              ))}
            </div>
            {boatType === "monohull" && (
              <div>
                <p className="mb-2 text-sm font-medium text-text-secondary">Rig preference</p>
                <div className="flex flex-wrap gap-2">
                  {RIG_TYPES.map((rigOption) => (
                    <button
                      key={rigOption.value}
                      onClick={() => setRigType(rigOption.value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        rigType === rigOption.value
                          ? "bg-primary-btn text-white"
                          : "border border-border text-text-secondary hover:border-primary hover:text-primary"
                      }`}
                    >
                      {rigOption.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Min Length (ft)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 35"
                  value={loaMin}
                  onChange={(event) => setLoaMin(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Max Length (ft)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={loaMax}
                  onChange={(event) => setLoaMax(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Minimum Year</label>
              <input
                type="number"
                placeholder="e.g. 2000"
                value={yearMin}
                onChange={(event) => setYearMin(event.target.value)}
                className={inputClass}
              />
            </div>
            <p className="text-xs text-text-tertiary">All fields optional - leave blank to see everything.</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                Home Port / Area
              </label>
              <input
                type="text"
                placeholder="e.g. Fort Lauderdale, FL"
                value={homePort}
                onChange={(event) => setHomePort(event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                Preferred Cruising Regions
              </label>
              <input
                type="text"
                placeholder="e.g. Caribbean, Mediterranean, Pacific NW"
                value={regions}
                onChange={(event) => setRegions(event.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Comma-separated - or leave blank for worldwide.
              </p>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-3">
            {EXPERIENCE_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => setExperience(level.value)}
                className={`rounded-xl border-2 p-5 text-left transition-all ${
                  experience === level.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="font-semibold">{level.label}</p>
                <p className="mt-0.5 text-sm text-text-secondary">{level.desc}</p>
              </button>
            ))}
          </div>
        )}

        {step === 6 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {TIMELINES.map((timelineOption) => (
              <button
                key={timelineOption.value}
                onClick={() => setTimeline(timelineOption.value)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  timeline === timelineOption.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="font-semibold">{timelineOption.label}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{timelineOption.desc}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <button
          onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((currentStep) => currentStep + 1)}
            disabled={!canAdvance()}
            className="flex items-center gap-1.5 rounded-full bg-primary-btn px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-light disabled:opacity-30"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={!canAdvance() || saving}
            className="flex items-center gap-1.5 rounded-full bg-accent-btn px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {saving ? "Finding your matches..." : "Find My Matches"}
          </button>
        )}
      </div>
    </div>
  );
}
