"use client";

import { useState } from "react";
import Link from "next/link";

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

function PlanCard({
  plan,
  onSelect,
}: {
  plan: (typeof buyerPlans)[0];
  onSelect: (tier: string) => void;
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
        className={`mt-8 w-full rounded-full py-2.5 text-sm font-medium ${
          plan.popular
            ? "bg-primary text-white hover:bg-primary-dark"
            : "border border-border hover:bg-muted"
        }`}
      >
        {plan.price === 0 ? "Get Started Free" : "Subscribe"}
      </button>
    </div>
  );
}

export default function PricingPage() {
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

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">⛵</span>
            <span className="text-xl font-bold text-primary">OnlyHulls</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Simple, Fair Pricing</h1>
          <p className="mt-3 text-lg text-foreground/60">
            No commissions, no hidden fees. Just flat monthly pricing.
          </p>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-bold">For Buyers</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {buyerPlans.map((plan) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>

        <div className="mt-20">
          <h2 className="text-2xl font-bold">For Sellers</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2 md:max-w-2xl">
            {sellerPlans.map((plan) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>

        {loading && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/20">
            <div className="rounded-lg bg-white p-8 shadow-xl">
              Redirecting to checkout...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
