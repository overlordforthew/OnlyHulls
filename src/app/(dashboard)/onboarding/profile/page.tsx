"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sailboat, Home, Flag, Fish, Anchor, Globe,
  ArrowRight, ArrowLeft, Check, Sparkles,
} from "lucide-react";

const STEPS = [
  { title: "What's Your Dream?", subtitle: "How will you use your boat?" },
  { title: "What's Your Budget?", subtitle: "No judgment — every range is valid" },
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
  { value: "0-25000", label: "Under $25K", desc: "Starter boats, project boats" },
  { value: "25000-75000", label: "$25K – $75K", desc: "Solid cruisers, older classics" },
  { value: "75000-150000", label: "$75K – $150K", desc: "Well-equipped bluewater boats" },
  { value: "150000-300000", label: "$150K – $300K", desc: "Premium cruisers, modern designs" },
  { value: "300000-500000", label: "$300K – $500K", desc: "Luxury yachts, performance cruisers" },
  { value: "500000+", label: "$500K+", desc: "Top-tier, custom builds" },
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
  { value: "novice", label: "Novice", desc: "New to boating — eager to learn" },
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

export default function ProfileQuestionnaire() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [useCases, setUseCases] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
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
    setUseCases((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function canAdvance(): boolean {
    switch (step) {
      case 0: return useCases.length > 0;
      case 1: return !!budget;
      case 2: return !!boatType;
      case 3: return true; // specs are optional
      case 4: return true; // location is optional
      case 5: return !!experience;
      case 6: return !!timeline;
      default: return false;
    }
  }

  async function handleFinish() {
    setSaving(true);

    const [budgetMin, budgetMax] = budget.includes("+")
      ? [parseInt(budget), 999999999]
      : budget.split("-").map(Number);

    const profile = {
      use_case: useCases,
      budget_range: { min: budgetMin || 0, max: budgetMax || 999999999, currency: "USD", refit_budget: 0 },
      boat_type_prefs: {
        types: boatType === "no-preference" ? [] : [boatType],
        rig_prefs: rigType && rigType !== "no-preference" ? [rigType] : [],
        hull_prefs: [],
      },
      spec_preferences: {
        ...(loaMin && { loa_min: parseInt(loaMin) }),
        ...(loaMax && { loa_max: parseInt(loaMax) }),
        ...(yearMin && { year_min: parseInt(yearMin) }),
      },
      location_prefs: {
        home_port: homePort,
        max_travel_km: 5000,
        regions: regions ? regions.split(",").map((r) => r.trim()) : [],
      },
      experience_level: experience,
      deal_breakers: [],
      timeline,
      refit_tolerance: "minor",
    };

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        router.push("/matches");
      } else {
        // Fallback — save worked but redirect to browse
        router.push("/boats");
      }
    } catch {
      router.push("/boats");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-foreground placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-text-secondary mb-2">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step header */}
      <h1 className="text-2xl font-bold">{STEPS[step].title}</h1>
      <p className="mt-1 text-text-secondary">{STEPS[step].subtitle}</p>

      {/* Step content */}
      <div className="mt-8">
        {/* Step 0: Use Case */}
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {USE_CASES.map((uc) => {
              const selected = useCases.includes(uc.value);
              return (
                <button
                  key={uc.value}
                  onClick={() => toggleUseCase(uc.value)}
                  className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <uc.icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? "text-primary" : "text-text-tertiary"}`} />
                  <div>
                    <p className="font-semibold">{uc.label}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">{uc.desc}</p>
                  </div>
                  {selected && <Check className="ml-auto h-5 w-5 shrink-0 text-primary" />}
                </button>
              );
            })}
            <p className="text-xs text-text-tertiary sm:col-span-2">Select one or more — many sailors have multiple goals</p>
          </div>
        )}

        {/* Step 1: Budget */}
        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {BUDGETS.map((b) => (
              <button
                key={b.value}
                onClick={() => setBudget(b.value)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  budget === b.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="text-lg font-bold">{b.label}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{b.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Boat Type */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {BOAT_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  onClick={() => setBoatType(bt.value)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    boatType === bt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="font-semibold">{bt.label}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{bt.desc}</p>
                </button>
              ))}
            </div>
            {boatType && boatType !== "powerboat" && boatType !== "no-preference" && (
              <div>
                <p className="mb-2 text-sm font-medium text-text-secondary">Rig preference</p>
                <div className="flex flex-wrap gap-2">
                  {RIG_TYPES.map((rt) => (
                    <button
                      key={rt.value}
                      onClick={() => setRigType(rt.value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                        rigType === rt.value
                          ? "bg-primary text-white"
                          : "border border-border text-text-secondary hover:border-primary hover:text-primary"
                      }`}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Size & Specs */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Min Length (ft)</label>
                <input type="number" placeholder="e.g. 35" value={loaMin} onChange={(e) => setLoaMin(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Max Length (ft)</label>
                <input type="number" placeholder="e.g. 50" value={loaMax} onChange={(e) => setLoaMax(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Minimum Year</label>
              <input type="number" placeholder="e.g. 2000" value={yearMin} onChange={(e) => setYearMin(e.target.value)} className={inputClass} />
            </div>
            <p className="text-xs text-text-tertiary">All fields optional — leave blank to see everything</p>
          </div>
        )}

        {/* Step 4: Location */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Home Port / Area</label>
              <input type="text" placeholder="e.g. Fort Lauderdale, FL" value={homePort} onChange={(e) => setHomePort(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Preferred Cruising Regions</label>
              <input type="text" placeholder="e.g. Caribbean, Mediterranean, Pacific NW" value={regions} onChange={(e) => setRegions(e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-text-tertiary">Comma-separated — or leave blank for worldwide</p>
            </div>
          </div>
        )}

        {/* Step 5: Experience */}
        {step === 5 && (
          <div className="grid gap-3">
            {EXPERIENCE_LEVELS.map((exp) => (
              <button
                key={exp.value}
                onClick={() => setExperience(exp.value)}
                className={`rounded-xl border-2 p-5 text-left transition-all ${
                  experience === exp.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="font-semibold">{exp.label}</p>
                <p className="mt-0.5 text-sm text-text-secondary">{exp.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 6: Timeline */}
        {step === 6 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {TIMELINES.map((tl) => (
              <button
                key={tl.value}
                onClick={() => setTimeline(tl.value)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  timeline === tl.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="font-semibold">{tl.label}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{tl.desc}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-10 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground disabled:opacity-30"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="flex items-center gap-1.5 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-light disabled:opacity-30"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={!canAdvance() || saving}
            className="flex items-center gap-1.5 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {saving ? "Finding your matches..." : "Find My Matches"}
          </button>
        )}
      </div>
    </div>
  );
}
