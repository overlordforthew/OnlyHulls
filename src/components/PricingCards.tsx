"use client";

import { useState } from "react";
import { Check, Flame } from "lucide-react";

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
    name: "Creator",
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
    name: "Featured Creator",
    price: 50,
    popular: true,
    features: [
      "Everything in Creator",
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
      className={`relative rounded-2xl border-2 p-8 transition-all ${
        plan.popular
          ? "border-accent bg-surface shadow-lg shadow-accent/10"
          : "border-border bg-surface hover:border-border-bright"
      }`}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
          <Flame className="h-3 w-3" />
          Most Popular
        </span>
      )}
      <h3 className="text-xl font-bold">{plan.name}</h3>
      <p className="mt-3">
        <span className="text-4xl font-bold">${plan.price}</span>
        {plan.price > 0 && (
          <span className="text-text-secondary">/month</span>
        )}
      </p>
      <ul className="mt-6 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-text-secondary">{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => onSelect(plan.tier)}
        disabled={loading}
        className={`mt-8 w-full rounded-full py-3 text-sm font-semibold transition-all disabled:opacity-50 ${
          plan.popular
            ? "bg-accent text-white hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
            : "border border-border text-foreground hover:border-primary hover:text-primary"
        }`}
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
      <h2 className="text-center text-2xl font-bold">Buyer Plans</h2>
      <p className="mx-auto mt-3 max-w-md text-center text-text-secondary">
        Browse for free, or upgrade for unlimited AI matching.
      </p>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
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
      <h2 className="text-center text-2xl font-bold">Seller Plans</h2>
      <p className="mx-auto mt-3 max-w-md text-center text-text-secondary">
        No commissions, no hidden fees — just flat monthly pricing.
      </p>
      <div className="mx-auto mt-10 grid max-w-2xl gap-6 sm:grid-cols-2">
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
