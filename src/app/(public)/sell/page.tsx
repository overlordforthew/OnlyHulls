import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  ClipboardList,
  Camera,
  Zap,
  Users,
  DollarSign,
  Globe,
  Shield,
  Clock,
  Check,
  X,
} from "lucide-react";
import { getPublicAppUrl } from "@/lib/config/urls";
import JsonLdScript from "@/components/JsonLdScript";
import { SellerPricing } from "@/components/PricingCards";
import { ListBoatCTA } from "@/components/MatchCTA";

const appUrl = getPublicAppUrl();

const STEP_CONFIG = [
  {
    key: "one",
    Icon: ClipboardList,
  },
  {
    key: "two",
    Icon: Camera,
  },
  {
    key: "three",
    Icon: Zap,
  },
  {
    key: "four",
    Icon: Users,
  },
];

const BENEFIT_CONFIG = [
  {
    key: "one",
    Icon: DollarSign,
  },
  {
    key: "two",
    Icon: Globe,
  },
  {
    key: "three",
    Icon: Shield,
  },
  {
    key: "four",
    Icon: Clock,
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sellPage");

  return {
    title: t("metadataTitle"),
    metadataBase: new URL(appUrl),
    description: t("metadataDescription"),
    alternates: {
      canonical: `${appUrl}/sell`,
    },
  };
}

export default async function SellPage() {
  const t = await getTranslations("sellPage");
  const steps = STEP_CONFIG.map((step) => ({
    ...step,
    title: t(`steps.${step.key}.title`),
    desc: t(`steps.${step.key}.description`),
  }));
  const benefits = BENEFIT_CONFIG.map((benefit) => ({
    ...benefit,
    title: t(`benefits.${benefit.key}.title`),
    desc: t(`benefits.${benefit.key}.description`),
  }));
  const comparison = ["commission", "listingFee", "buyerMatching", "reach", "timeToList"].map((key) => ({
    feature: t(`comparison.${key}.feature`),
    us: t(`comparison.${key}.us`),
    them: t(`comparison.${key}.them`),
  }));
  const faqs = ["one", "two", "three", "four"].map((key) => ({
    question: t(`faqs.${key}.question`),
    answer: t(`faqs.${key}.answer`),
  }));
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div>
      <JsonLdScript data={faqSchema} />

      <section className="relative overflow-hidden pb-16 pt-12 sm:pb-20 sm:pt-16">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
          <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-accent/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              <Zap className="h-3 w-3" />
              {t("badge")}
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t("heroTitleStart")} <span className="text-primary">{t("heroTitleAccent")}</span>
            </h1>
            <p className="mt-4 text-lg text-text-secondary">
              {t("heroDescription")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ListBoatCTA className="rounded-full bg-accent-btn px-8 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20" />
              <a
                href="#pricing"
                className="rounded-full border border-border-bright px-8 py-3 text-center text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
              >
                {t("seePricing")}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold">{t("howHeading")}</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border border-border bg-surface p-8 transition-all hover:border-primary/30"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">
                      <span className="text-primary">{i + 1}.</span>{" "}
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm text-text-secondary">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-sm text-text-secondary">
            {t("stepFootnote")}
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold">
            {t("whyHeadingStart")} <span className="text-primary">{t("whyHeadingAccent")}</span>{t("whyHeadingEnd") ? ` ${t("whyHeadingEnd")}` : ""}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="group rounded-2xl border border-border bg-surface p-8 transition-all hover:border-primary/30"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary/20">
                    <benefit.Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{benefit.title}</h3>
                    <p className="mt-2 text-sm text-text-secondary">{benefit.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold">
            {t("comparisonHeading")}
          </h2>
          <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-6 py-4 font-semibold text-text-secondary">{t("table.feature")}</th>
                  <th className="px-6 py-4 font-semibold text-primary">{t("table.onlyHulls")}</th>
                  <th className="px-6 py-4 font-semibold text-text-tertiary">{t("table.broker")}</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-border last:border-0 ${
                      i % 2 === 0 ? "bg-surface-elevated" : "bg-surface"
                    }`}
                  >
                    <td className="px-6 py-4 font-medium">{row.feature}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                        <Check className="h-4 w-4" />
                        {row.us}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-text-tertiary">
                        <X className="h-4 w-4" />
                        {row.them}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <SellerPricing />
        </div>
      </section>

      <section className="border-t border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">
              {t("faqEyebrow")}
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {t("faqHeading")}
            </h2>
            <p className="mt-3 text-text-secondary">
              {t("faqSubtitle")}
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-2xl border border-border bg-surface p-6"
              >
                <h3 className="text-lg font-semibold">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-text-secondary">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <h2 className="text-3xl font-bold">
            {t("finalHeadingStart")} <span className="text-primary">{t("finalHeadingAccent")}</span>{t("finalHeadingEnd")}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-secondary">
            {t("finalDescription")}
          </p>
          <ListBoatCTA className="mt-8 inline-block rounded-full bg-accent-btn px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20" />
        </div>
      </section>
    </div>
  );
}
