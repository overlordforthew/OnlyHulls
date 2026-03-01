"use client";

import { useState } from "react";

const buyerPlans = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    features: [
      "Browse all listings",
      "10 saves/day",
      "Basic search filters",
      "View match scores",
    ],
  },
  {
    tier: "plus",
    name: "Plus",
    price: 10,
    popular: true,
    features: [
      "Unlimited saves & matching",
      "AI buyer profile",
      "Match score breakdowns",
      "Saved searches & alerts",
      "Dreamboard",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: 30,
    features: [
      "Everything in Plus",
      "Priority in seller notifications",
      "Advanced match filters",
      "External boat aggregation",
      "Direct messaging",
    ],
  },
];

const sellerPlans = [
  {
    tier: "standard",
    name: "Standard",
    price: 30,
    features: [
      "AI-assisted listing creation",
      "Standard visibility",
      "Up to 20 photos",
      "Match notifications",
      "Email introductions",
    ],
  },
  {
    tier: "featured",
    name: "Featured",
    price: 50,
    popular: true,
    features: [
      "Everything in Standard",
      "Boosted placement in feed",
      "Video walkthrough AI",
      "Analytics dashboard",
      "Up to 50 photos",
      "Priority matching",
    ],
  },
];

type Plan = (typeof buyerPlans)[0];

function PlanCard({
  plan,
  onSelect,
  loading,
}: {
  plan: Plan;
  onSelect: (tier: string) => void;
  loading: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-2 p-6 ${
        plan.popular ? "border-primary shadow-lg" : "border-border"
      }`}
    >
      {plan.popular && (
        <span className="mb-4 inline-block rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
          Most Popular
        </span>
      )}
      <h3 className="text-xl font-bold">{plan.name}</h3>
      <p className="mt-2">
        <span className="text-4xl font-bold">${plan.price}</span>
        {plan.price > 0 && (
          <span className="text-foreground/60">/month</span>
        )}
      </p>
      <ul className="mt-6 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 text-primary">&#10003;</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={() => onSelect(plan.tier)}
        disabled={loading}
        className={`mt-8 w-full rounded-full py-2.5 text-sm font-medium ${
          plan.popular
            ? "bg-primary text-white hover:bg-primary-dark"
            : "border border-border hover:bg-muted"
        } disabled:opacity-50`}
      >
        {plan.price === 0 ? "Get Started Free" : "Subscribe"}
      </button>
    </div>
  );
}

function useCheckout() {
  const [loading, setLoading] = useState(false);

  async function handleSelect(tier: string) {
    if (tier === "free") {
      window.location.href = "/sign-up";
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return { loading, handleSelect };
}

export function BuyerPricing() {
  const { loading, handleSelect } = useCheckout();

  return (
    <div>
      <h2 className="text-2xl font-bold">Buyer Plans</h2>
      <p className="mt-2 text-foreground/60">
        Browse for free, or upgrade for unlimited AI matching.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {buyerPlans.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            onSelect={handleSelect}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}

export function SellerPricing() {
  const { loading, handleSelect } = useCheckout();

  return (
    <div>
      <h2 className="text-2xl font-bold">Seller Plans</h2>
      <p className="mt-2 text-foreground/60">
        No commissions, no hidden fees — just flat monthly pricing.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 sm:max-w-2xl">
        {sellerPlans.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            onSelect={handleSelect}
            loading={loading}
          />
        ))}
      </div>
    </div>
  );
}
