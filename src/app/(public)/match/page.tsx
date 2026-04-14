import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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

export const metadata: Metadata = {
  title: "AI Boat Matching",
  metadataBase: new URL(appUrl),
  description:
    "Tell us your dream boat and our AI will match you with the best listings, even when you do not know exactly what you are looking for.",
  alternates: {
    canonical: `${appUrl}/match`,
  },
};

const STEPS = [
  {
    Icon: MessageSquare,
    title: "Tell Us Your Dream",
    desc: "Chat with our AI to build your buyer profile. It learns what you need - budget, size, sailing style, and even the things you have not thought through yet.",
  },
  {
    Icon: Target,
    title: "Get Matched",
    desc: "Our engine scores every listing against your profile using AI similarity and smart filters. Best matches float to the top.",
  },
  {
    Icon: Handshake,
    title: "Connect Directly",
    desc: "Found the one? Connect directly with the seller. No brokers, no middlemen, and no 10% commission eating into the deal.",
  },
];

const FEATURES = [
  {
    Icon: Sparkles,
    title: "Learns What You Want",
    desc: "The AI builds a rich profile from a natural conversation, not a tedious form. It picks up on preferences you might not realize you have.",
  },
  {
    Icon: Sailboat,
    title: "Scores Every Listing",
    desc: "Every boat gets a match percentage based on your profile. Sort by match score to see what fits you best.",
  },
  {
    Icon: Shield,
    title: "Private and Secure",
    desc: "Your profile is yours. Sellers see your interest, not your data. You control when and how you connect.",
  },
  {
    Icon: DollarSign,
    title: "Zero Commission",
    desc: "We do not take a cut of your deal. Matching is free. Premium features are optional.",
  },
];

const MATCH_SCORES = [97, 91, 84];

const START_SIGNALS = [
  {
    title: "Takes a couple of minutes",
    description: "Start with a short chat instead of a long form. The AI builds your buyer profile from that conversation.",
  },
  {
    title: "Your results stay saved",
    description: "Matches, shortlist signals, and your buyer profile stay attached to your account when you come back.",
  },
  {
    title: "Direct seller contact",
    description: "When you are ready, you connect directly with the seller. No broker commission is added by OnlyHulls.",
  },
];

const FAQS = [
  {
    question: "How does OnlyHulls decide what is a good match?",
    answer:
      "OnlyHulls combines your buyer profile, boat type, budget, specs, location signals, and AI-assisted ranking to score listings. Stronger matches rise to the top, but you can still browse the full market yourself.",
  },
  {
    question: "Do I have to know the exact make and model I want?",
    answer:
      "No. The matching flow is built for buyers who know the lifestyle, budget, and mission more than the exact boat. The AI uses those signals to surface likely fits and explain the tradeoffs.",
  },
  {
    question: "Can I still sort and browse boats manually after I get matched?",
    answer:
      "Yes. Your matches are saved, and you can still sort by price, size, year, and listing date while comparing listings across the broader inventory.",
  },
  {
    question: "What do I get with Buyer Plus?",
    answer:
      "Buyer Plus unlocks longer-term AI matching, unlimited saves, better shortlist tools, and saved-search alerts over a 90-day period while keeping direct contact with sellers commission-free.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

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
  const boats = await getFeaturedBoats(3);
  const intelligenceEnabled = matchIntelligenceConfigured();
  const semanticEnabled = semanticMatchingEnabled();
  const intelligenceProviderLabel = formatProviderLabel(matchIntelligenceProvider());
  const embeddingProviderLabel = formatProviderLabel(embeddingProvider());

  const stackSignals = [
    intelligenceEnabled
      ? {
          label: "AI matching is live",
          value: `Reranking is powered by ${intelligenceProviderLabel}.`,
        }
      : {
          label: "Smart matching is active",
          value: "Rules, shortlist signals, and buyer filters are still doing the heavy lifting.",
        },
    semanticEnabled
      ? {
          label: "Semantic ranking is on",
          value: `Profile similarity is running through ${embeddingProviderLabel} embeddings.`,
        }
      : {
          label: "Spec ranking is on",
          value: "Budget, size, location, and boat-type filters stay in the scoring mix.",
        },
    {
      label: "Your matches stay saved",
      value: "Come back anytime to sort by price, size, year, or newest without starting over.",
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
                AI-Powered
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Your Perfect <span className="text-primary">Match</span> is Waiting
              </h1>
              <p className="mt-4 text-lg text-text-secondary">
                Tell us your dream boat and our AI will match you with the best
                listings, even when you do not know exactly what you are looking
                for.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <MatchCTAPrimary className="rounded-full bg-accent-btn px-8 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20" />
                <Link
                  href="/boats"
                  className="rounded-full border border-border-bright px-8 py-3 text-center text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
                >
                  Browse Boats Instead
                </Link>
              </div>
              <p className="mt-4 max-w-2xl text-sm text-text-secondary">
                Your buyer profile and shortlist stay attached to your account,
                so you can come back later and keep narrowing the field without
                starting over.
              </p>

              <div
                className="mt-6 grid gap-3 sm:grid-cols-3"
                data-testid="match-start-signals"
              >
                {START_SIGNALS.map((signal) => (
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
                  Preview - Example AI Match Results
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
                        {MATCH_SCORES[i]}% (example)
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
          <h2 className="text-center text-2xl font-bold">How It Works</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border border-border bg-surface p-8 text-center"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.Icon className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <p className="mt-2 text-xs font-semibold text-text-tertiary">
                  Step {i + 1}
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
          <h2 className="text-center text-2xl font-bold">Why AI Matching?</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
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
              Buyer FAQ
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Questions buyers usually ask before they start matching
            </h2>
            <p className="mt-3 text-text-secondary">
              These are the practical questions we see most often from buyers using
              OnlyHulls to narrow the market quickly.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {FAQS.map((faq) => (
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
            Ready to Find <span className="text-primary">The One</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-secondary">
            Create a free account, chat with our AI, and see your matches in minutes.
          </p>
          <MatchCTASecondary className="mt-8 inline-block rounded-full bg-accent-btn px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20" />
        </div>
      </section>
    </div>
  );
}
