"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "basics" | "specs" | "details" | "location" | "photos" | "review";
const STEPS: Step[] = ["basics", "specs", "details", "location", "photos", "review"];
const STEP_LABELS: Record<Step, string> = {
  basics: "Basics",
  specs: "Specifications",
  details: "Details",
  location: "Location & Price",
  photos: "Photos",
  review: "Review",
};

interface ListingData {
  make: string;
  model: string;
  year: number;
  askingPrice: number;
  currency: string;
  locationText: string;
  hullId: string;
  specs: {
    loa?: number;
    beam?: number;
    draft?: number;
    rig_type?: string;
    hull_material?: string;
    engine?: string;
    fuel_type?: string;
    berths?: number;
    heads?: number;
  };
  characterTags: string[];
  conditionScore: number;
  description: string;
  media: { url: string; caption: string; sortOrder: number }[];
}

export default function NewListingPage() {
  const [step, setStep] = useState<Step>("basics");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const [data, setData] = useState<ListingData>({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    askingPrice: 0,
    currency: "USD",
    locationText: "",
    hullId: "",
    specs: {},
    characterTags: [],
    conditionScore: 5,
    description: "",
    media: [],
  });

  const currentIdx = STEPS.indexOf(step);
  const canNext = currentIdx < STEPS.length - 1;
  const canBack = currentIdx > 0;

  function update(partial: Partial<ListingData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function updateSpecs(partial: Partial<ListingData["specs"]>) {
    setData((prev) => ({ ...prev, specs: { ...prev.specs, ...partial } }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create listing");
      const result = await res.json();
      router.push(`/boats/${result.slug || result.id}`);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">List Your Boat</h1>

      {/* Step indicator */}
      <div className="mt-6 flex gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => i <= currentIdx && setStep(s)}
            className={`flex-1 rounded-full py-1.5 text-xs font-medium ${
              s === step
                ? "bg-primary-btn text-white"
                : i < currentIdx
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-foreground/40"
            }`}
          >
            {STEP_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-6">
        {step === "basics" && (
          <>
            <Field label="Make" value={data.make} onChange={(v) => update({ make: v })} placeholder="e.g. Beneteau" />
            <Field label="Model" value={data.model} onChange={(v) => update({ model: v })} placeholder="e.g. Oceanis 40.1" />
            <NumberField label="Year" value={data.year} onChange={(v) => update({ year: v })} />
            <Field label="Hull ID (HIN)" value={data.hullId} onChange={(v) => update({ hullId: v })} placeholder="Optional" />
          </>
        )}

        {step === "specs" && (
          <>
            <NumberField label="LOA (feet)" value={data.specs.loa} onChange={(v) => updateSpecs({ loa: v })} />
            <NumberField label="Beam (feet)" value={data.specs.beam} onChange={(v) => updateSpecs({ beam: v })} />
            <NumberField label="Draft (feet)" value={data.specs.draft} onChange={(v) => updateSpecs({ draft: v })} />
            <Select label="Rig Type" value={data.specs.rig_type || ""} onChange={(v) => updateSpecs({ rig_type: v })} options={["sloop", "cutter", "ketch", "yawl", "schooner", "cat"]} />
            <Select label="Hull Material" value={data.specs.hull_material || ""} onChange={(v) => updateSpecs({ hull_material: v })} options={["fiberglass", "steel", "aluminum", "wood", "carbon", "ferro-cement"]} />
            <Field label="Engine" value={data.specs.engine || ""} onChange={(v) => updateSpecs({ engine: v })} placeholder="e.g. Yanmar 40HP diesel" />
            <NumberField label="Berths" value={data.specs.berths} onChange={(v) => updateSpecs({ berths: v })} />
            <NumberField label="Heads" value={data.specs.heads} onChange={(v) => updateSpecs({ heads: v })} />
          </>
        )}

        {step === "details" && (
          <>
            <div>
              <label className="block text-sm font-medium">Description</label>
              <textarea
                value={data.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={6}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                placeholder="Tell potential buyers about your boat..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Condition (1-10)</label>
              <input
                type="range"
                min={1}
                max={10}
                value={data.conditionScore}
                onChange={(e) => update({ conditionScore: parseInt(e.target.value) })}
                className="mt-1 w-full"
              />
              <p className="text-sm text-foreground/60">{data.conditionScore}/10</p>
            </div>
            <div>
              <label className="block text-sm font-medium">Character Tags</label>
              <p className="text-xs text-foreground/50">Select all that apply</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "bluewater", "coastal-cruiser", "liveaboard-ready", "race-ready",
                  "weekender", "project-boat", "turnkey", "classic", "modern",
                  "family-friendly", "solo-sailor", "budget-friendly",
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const tags = data.characterTags.includes(tag)
                        ? data.characterTags.filter((t) => t !== tag)
                        : [...data.characterTags, tag];
                      update({ characterTags: tags });
                    }}
                    className={`rounded-full px-3 py-1 text-xs ${
                      data.characterTags.includes(tag)
                        ? "bg-primary-btn text-white"
                        : "bg-muted text-foreground/60"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === "location" && (
          <>
            <Field label="Location" value={data.locationText} onChange={(v) => update({ locationText: v })} placeholder="e.g. Honolulu, HI" />
            <NumberField label="Asking Price" value={data.askingPrice} onChange={(v) => update({ askingPrice: v })} />
            <Select label="Currency" value={data.currency} onChange={(v) => update({ currency: v })} options={["USD", "EUR", "GBP", "AUD", "NZD", "CAD"]} />
          </>
        )}

        {step === "photos" && (
          <div>
            <p className="text-sm text-foreground/60">
              Photo upload requires Hetzner Object Storage to be configured.
              You can add photos after publishing your listing.
            </p>
            <div className="mt-4 rounded-lg border-2 border-dashed border-border p-12 text-center">
              <p className="text-foreground/40">
                Drag and drop photos here, or click to browse
              </p>
              <p className="mt-1 text-xs text-foreground/30">
                JPG, PNG, WebP up to 10MB each
              </p>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Review Your Listing</h2>
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p><strong>{data.year} {data.make} {data.model}</strong></p>
              <p className="mt-1">${data.askingPrice.toLocaleString()} {data.currency}</p>
              {data.locationText && <p className="mt-1">{data.locationText}</p>}
              {data.specs.loa && <p className="mt-1">LOA: {data.specs.loa}ft</p>}
              {data.specs.rig_type && <p>Rig: {data.specs.rig_type}</p>}
              {data.characterTags.length > 0 && (
                <p className="mt-1">Tags: {data.characterTags.join(", ")}</p>
              )}
              {data.description && (
                <p className="mt-2 text-foreground/60">{data.description}</p>
              )}
            </div>
            <p className="text-sm text-foreground/60">
              Your listing will be reviewed by an admin before going live.
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <button
          onClick={() => canBack && setStep(STEPS[currentIdx - 1])}
          disabled={!canBack}
          className="rounded-full border border-border px-6 py-2 text-sm hover:bg-muted disabled:opacity-30"
        >
          Back
        </button>
        {step === "review" ? (
          <button
            onClick={handleSubmit}
            disabled={submitting || !data.make || !data.model}
            className="rounded-full bg-primary-btn px-8 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit for Review"}
          </button>
        ) : (
          <button
            onClick={() => canNext && setStep(STEPS[currentIdx + 1])}
            disabled={!canNext}
            className="rounded-full bg-primary-btn px-6 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function NumberField({ label, value, onChange }: {
  label: string; value: number | undefined; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
