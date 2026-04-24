import type { Metadata } from "next";
import Link from "@/components/LocaleLink";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Sailboat,
  MessageSquare,
  Target,
  Handshake,
  Sparkles,
  Shield,
  DollarSign,
  Heart,
} from "lucide-react";
import { getFeaturedBoats } from "@/lib/db/queries";
import { getPublicAppUrl } from "@/lib/config/urls";
import {
  embeddingProvider,
  matchIntelligenceConfigured,
  matchIntelligenceProvider,
  semanticMatchingEnabled,
} from "@/lib/capabilities";
import { BuyerPricing } from "@/components/PricingCards";
import JsonLdScript from "@/components/JsonLdScript";
import { MatchCTAPrimary, MatchCTASecondary } from "@/components/MatchCTA";

export const dynamic = "force-dynamic";

const appUrl = getPublicAppUrl();

const STEP_CONFIG = [
  {
    key: "one",
    Icon: MessageSquare,
  },
  {
    key: "two",
    Icon: Target,
  },
  {
    key: "three",
    Icon: Handshake,
  },
];

const FEATURE_CONFIG = [
  {
    key: "one",
    Icon: Sparkles,
  },
  {
    key: "two",
    Icon: Sailboat,
  },
  {
    key: "three",
    Icon: Shield,
  },
  {
    key: "four",
    Icon: DollarSign,
  },
];

const MATCH_SCORES = [97, 91, 84];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("matchPage");
  const locale = await getLocale();
  const canonical = locale === "en" ? `${appUrl}/match` : `${appUrl}/${locale}/match`;

  return {
    title: t("metadataTitle"),
    metadataBase: new URL(appUrl),
    description: t("metadataDescription"),
    alternates: {
      canonical,
      languages: {
        en: `${appUrl}/match`,
        es: `${appUrl}/es/match`,
        "x-default": `${appUrl}/match`,
      },
    },
  };
}

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatProviderLabel(provider: string): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "openrouter":
      return "OpenRouter";
    case "ollama":
      return "Ollama";
    default:
      return "OnlyHulls";
  }
}

export default async function MatchPage() {
  const t = await getTranslations("matchPage");
  const intelligenceEnabled = matchIntelligenceConfigured();
  const semanticEnabled = semanticMatchingEnabled();
  const intelligenceProviderLabel = formatProviderLabel(matchIntelligenceProvider());
  const embeddingProviderLabel = formatProviderLabel(embeddingProvider());
  const boats = await getFeaturedBoats(3, { context: "/match" });
  const steps = STEP_CONFIG.map((step) => ({
    ...step,
    title: t(`steps.${step.key}.title`),
    desc: t(`steps.${step.key}.description`),
  }));
  const features = FEATURE_CONFIG.map((feature) => ({
    ...feature,
    title: t(`features.${feature.key}.title`),
    desc: t(`features.${feature.key}.description`),
  }));
  const startSignals = ["one", "two", "three"].map((key) => ({
    title: t(`startSignals.${key}.title`),
    description: t(`startSignals.${key}.description`),
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

  const stackSignals = [
    intelligenceEnabled
      ? {
          label: t("stackSignals.aiLive"),
          value: t("stackSignals.aiLiveValue", { provider: intelligenceProviderLabel }),
        }
      : {
          label: t("stackSignals.smartMatching"),
          value: t("stackSignals.smartMatchingValue"),
        },
    semanticEnabled
      ? {
          label: t("stackSignals.semanticOn"),
          value: t("stackSignals.semanticOnValue", { provider: embeddingProviderLabel }),
        }
      : {
          label: t("stackSignals.specRanking"),
          value: t("stackSignals.specRankingValue"),
        },
    {
      label: t("stackSignals.saved"),
      value: t("stackSignals.savedValue"),
    },
  ];

  return (
    <div>
      <JsonLdScript data={faqSchema} />

      <section className="relative overflow-hidden pb-16 pt-12 sm:pb-20 sm:pt-16">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-success/5 via-transparent to-transparent" />
          <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-success/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-5">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                <Heart className="h-3 w-3" />
                {t("badge")}
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {t("heroTitleStart")} <span className="text-primary">{t("heroTitleAccent")}</span> {t("heroTitleEnd")}
              </h1>
              <p className="mt-4 text-lg text-text-secondary">
                {t("heroDescription")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <MatchCTAPrimary className="rounded-full bg-accent-btn px-8 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20" />
                <Link
                  href="/boats"
                  className="rounded-full border border-border-bright px-8 py-3 text-center text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
                >
                  {t("browseInstead")}
                </Link>
              </div>
              <p className="mt-4 max-w-2xl text-sm text-text-secondary">
                {t("heroFootnote")}
              </p>

              <div
                className="mt-6 grid gap-3 sm:grid-cols-3"
                data-testid="match-start-signals"
              >
                {startSignals.map((signal) => (
                  <div
                    key={signal.title}
                    className="rounded-2xl border border-border bg-surface/70 p-4"
                  >
                    <p className="text-sm font-semibold">{signal.title}</p>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">
                      {signal.description}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className="mt-6 grid gap-3 sm:grid-cols-3"
                data-testid="match-stack-status"
              >
                {stackSignals.map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-2xl border border-border bg-surface/70 p-4"
                  >
                    <p className="text-sm font-semibold">{signal.label}</p>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">
                      {signal.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {boats.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-6">
                <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  {t("previewEyebrow")}
                </p>
                <div className="flex flex-col gap-3">
                  {boats.map((boat, i) => (
                    <div
                      key={boat.id}
                      className="flex items-center gap-4 rounded-xl border border-border bg-surface-elevated p-4 transition-all hover:border-primary/30"
                    >
                      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {boat.hero_url ? (
                          <Image
                            src={boat.hero_url}
                            alt={`${boat.year} ${boat.make} ${boat.model}`}
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Sailboat className="h-6 w-6 text-text-tertiary" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {`${boat.year} ${boat.make} ${boat.model}`}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {formatPrice(boat.asking_price, boat.currency)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-gradient-to-r from-success to-primary px-3 py-1 text-xs font-bold text-white">
                        {t("exampleMatch", { score: MATCH_SCORES[i] })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold">{t("howItWorks")}</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border border-border bg-surface p-8 text-center"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.Icon className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <p className="mt-2 text-xs font-semibold text-text-tertiary">
                  {t("stepLabel", { number: i + 1 })}
                </p>
                <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold">{t("whyHeading")}</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border bg-surface p-8 transition-all hover:border-primary/30"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary/20">
                    <feature.Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-text-secondary">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <BuyerPricing />
        </div>
      </section>

      <section className="py-16 sm:py-20">
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
          <MatchCTASecondary className="mt-8 inline-block rounded-full bg-accent-btn px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20" />
        </div>
      </section>
    </div>
  );
}
