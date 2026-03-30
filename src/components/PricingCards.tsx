"use client";

import { useState } from "react";
import { Check, Star } from "lucide-react";

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
    tier: "free-seller",
    name: "Free",
    price: 0,
    features: [
      "1 active listing",
      "Manual text-based entry",
      "Up to 10 photos",
      "Standard visibility",
      "Match notifications",
    ],
  },
  {
    tier: "standard",
    name: "Creator",
    price: 30,
    popular: true,
    features: [
      "Unlimited active listings",
      "AI-assisted listing creation",
      "Dynamic photo uploads",
      "Up to 30 photos per listing",
      "Match notifications",
    ],
  },
  {
    tier: "featured",
    name: "Featured Creator",
    price: 50,
    features: [
      "Everything in Creator",
      "Video upload + AI analysis",
      "Boosted placement in feed",
      "Featured in buyer email blasts",
      "Analytics dashboard",
      "Up to 50 photos per listing",
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
      className={`relative rounded-2xl border p-8 transition-all ${
        plan.popular
          ? "border-primary/40 bg-surface-elevated"
          : "border-border bg-surface"
      }`}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary-btn px-3 py-1 text-xs font-semibold text-white">
          <Star className="h-3 w-3" />
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
        className={`mt-8 w-full rounded-full py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${
          plan.popular
            ? "bg-primary-btn text-white hover:bg-primary-light"
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
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
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
