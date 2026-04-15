"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Star } from "lucide-react";

type Plan = {
  tier: string;
  name: string;
  price: number;
  billingLabel?: string;
  priceNote?: string;
  ctaLabel?: string;
  popular?: boolean;
  features: string[];
};

type PricingTranslator = (key: string, values?: Record<string, string | number>) => string;

function getBuyerPlans(t: PricingTranslator): Plan[] {
  return [
    {
      tier: "free",
      name: t("buyerPlans.free.name"),
      price: 0,
      billingLabel: "",
      priceNote: "",
      ctaLabel: t("buyerPlans.free.cta"),
      features: [
        t("buyerPlans.free.features.one"),
        t("buyerPlans.free.features.two"),
        t("buyerPlans.free.features.three"),
        t("buyerPlans.free.features.four"),
      ],
    },
    {
      tier: "plus",
      name: t("buyerPlans.plus.name"),
      price: 25,
      billingLabel: t("buyerPlans.plus.billingLabel"),
      priceNote: t("buyerPlans.plus.priceNote"),
      ctaLabel: t("buyerPlans.plus.cta"),
      popular: true,
      features: [
        t("buyerPlans.plus.features.one"),
        t("buyerPlans.plus.features.two"),
        t("buyerPlans.plus.features.three"),
        t("buyerPlans.plus.features.four"),
        t("buyerPlans.plus.features.five"),
      ],
    },
  ];
}

function getSellerPlans(t: PricingTranslator): Plan[] {
  return [
    {
      tier: "free-seller",
      name: t("sellerPlans.freeSeller.name"),
      price: 0,
      billingLabel: "",
      priceNote: "",
      ctaLabel: t("sellerPlans.freeSeller.cta"),
      features: [
        t("sellerPlans.freeSeller.features.one"),
        t("sellerPlans.freeSeller.features.two"),
        t("sellerPlans.freeSeller.features.three"),
        t("sellerPlans.freeSeller.features.four"),
        t("sellerPlans.freeSeller.features.five"),
      ],
    },
    {
      tier: "standard",
      name: t("sellerPlans.standard.name"),
      price: 30,
      billingLabel: t("sellerPlans.standard.billingLabel"),
      priceNote: t("sellerPlans.standard.priceNote"),
      ctaLabel: t("sellerPlans.standard.cta"),
      popular: true,
      features: [
        t("sellerPlans.standard.features.one"),
        t("sellerPlans.standard.features.two"),
        t("sellerPlans.standard.features.three"),
        t("sellerPlans.standard.features.four"),
        t("sellerPlans.standard.features.five"),
      ],
    },
    {
      tier: "featured",
      name: t("sellerPlans.featured.name"),
      price: 60,
      billingLabel: t("sellerPlans.featured.billingLabel"),
      priceNote: t("sellerPlans.featured.priceNote"),
      ctaLabel: t("sellerPlans.featured.cta"),
      features: [
        t("sellerPlans.featured.features.one"),
        t("sellerPlans.featured.features.two"),
        t("sellerPlans.featured.features.three"),
        t("sellerPlans.featured.features.four"),
        t("sellerPlans.featured.features.five"),
        t("sellerPlans.featured.features.six"),
        t("sellerPlans.featured.features.seven"),
      ],
    },
  ];
}

function PlanCard({
  plan,
  onSelect,
  loading,
}: {
  plan: Plan;
  onSelect: (tier: string) => void;
  loading: boolean;
}) {
  const t = useTranslations("pricing");
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
          {t("mostPopular")}
        </span>
      )}
      <h3 className="text-xl font-bold">{plan.name}</h3>
      <p className="mt-3">
        <span className="text-4xl font-bold">${plan.price}</span>
        {plan.price > 0 && plan.billingLabel && (
          <span className="text-text-secondary"> {plan.billingLabel}</span>
        )}
      </p>
      {plan.price > 0 && plan.priceNote && (
        <p className="mt-1 text-sm text-text-secondary">{plan.priceNote}</p>
      )}
      <ul className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-text-secondary">{feature}</span>
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
        {plan.ctaLabel || (plan.price === 0 ? t("getStartedFree") : t("subscribe"))}
      </button>
    </div>
  );
}

function useCheckout() {
  const t = useTranslations("pricing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingEnabled, setBillingEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/public/capabilities")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.billingEnabled === "boolean") {
          setBillingEnabled(data.billingEnabled);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSelect(tier: string) {
    setError(null);
    if (tier === "free") {
      window.location.href = "/sign-up";
      return;
    }
    if (!billingEnabled && tier !== "free-seller") {
      setError(t("billingUnavailable"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && tier === "free-seller") {
        window.location.href = "/sign-up?role=seller";
        return;
      }
      if (!res.ok) {
        setError(data.error || t("billingUnavailable"));
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return { loading, handleSelect, error, billingEnabled };
}

export function BuyerPricing() {
  const t = useTranslations("pricing");
  const { loading, handleSelect, error, billingEnabled } = useCheckout();
  const buyerPlans = getBuyerPlans(t);

  return (
    <div>
      <h2 className="text-center text-2xl font-bold">{t("buyerHeading")}</h2>
      <p className="mx-auto mt-3 max-w-md text-center text-text-secondary">
        {t("buyerSubtitle")}
      </p>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-2">
        {buyerPlans.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            onSelect={handleSelect}
            loading={loading || (plan.price > 0 && !billingEnabled)}
          />
        ))}
      </div>
      {error && <p className="mt-4 text-center text-sm text-accent">{error}</p>}
      <p className="mt-4 text-center text-sm text-text-secondary">
        {t("buyerFootnote")}
      </p>
      {!billingEnabled && (
        <p className="mt-2 text-center text-sm text-text-secondary">
          {t("billingUnavailableEnv")}
        </p>
      )}
    </div>
  );
}

export function SellerPricing() {
  const t = useTranslations("pricing");
  const { loading, handleSelect, error, billingEnabled } = useCheckout();
  const sellerPlans = getSellerPlans(t);

  return (
    <div>
      <h2 className="text-center text-2xl font-bold">{t("sellerHeading")}</h2>
      <p className="mx-auto mt-3 max-w-md text-center text-text-secondary">
        {t("sellerSubtitle")}
      </p>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
        {sellerPlans.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            onSelect={handleSelect}
            loading={loading || (plan.price > 0 && !billingEnabled)}
          />
        ))}
      </div>
      {error && <p className="mt-4 text-center text-sm text-accent">{error}</p>}
      <p className="mt-4 text-center text-sm text-text-secondary">
        {t("sellerFootnote")}
      </p>
      {!billingEnabled && (
        <p className="mt-2 text-center text-sm text-text-secondary">
          {t("sellerBillingUnavailableEnv")}
        </p>
      )}
    </div>
  );
}
