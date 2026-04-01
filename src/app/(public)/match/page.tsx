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
import { BuyerPricing } from "@/components/PricingCards";
import { MatchCTAPrimary, MatchCTASecondary } from "@/components/MatchCTA";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Boat Matching",
  description:
    "Tell us your dream boat and our AI will match you with the best listings — even when you don't know exactly what you're looking for.",
};

const STEPS = [
  {
    Icon: MessageSquare,
    title: "Tell Us Your Dream",
    desc: "Chat with our AI to build your buyer profile. It learns what you need — budget, size, sailing style, even the things you haven't thought of yet.",
  },
  {
    Icon: Target,
    title: "Get Matched",
    desc: "Our engine scores every listing against your profile using AI similarity and smart filters. Best matches float to the top.",
  },
  {
    Icon: Handshake,
    title: "Connect Directly",
    desc: "Found the one? Connect directly with the seller. No brokers, no middlemen, no 10% commission eating into the deal.",
  },
];

const FEATURES = [
  {
    Icon: Sparkles,
    title: "Learns What You Want",
    desc: "The AI builds a rich profile from a natural conversation — not a tedious form. It picks up on preferences you might not realize you have.",
  },
  {
    Icon: Sailboat,
    title: "Scores Every Listing",
    desc: "Every boat gets a match percentage based on your profile. Sort by match score to see what fits you best.",
  },
  {
    Icon: Shield,
    title: "Private & Secure",
    desc: "Your profile is yours. Sellers see your interest, not your data. You control when and how you connect.",
  },
  {
    Icon: DollarSign,
    title: "Zero Commission",
    desc: "We don't take a cut of your deal. Matching is free. Premium features are optional.",
  },
];

const MATCH_SCORES = [97, 91, 84];

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

export default async function MatchPage() {
  const boats = await getFeaturedBoats(3);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden pb-16 pt-12 sm:pb-20 sm:pt-16">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-success/5 via-transparent to-transparent" />
          <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-success/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-5">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left — text */}
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                <Heart className="h-3 w-3" />
                AI-Powered
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Your Perfect{" "}
                <span className="text-primary">Match</span>{" "}
                is Waiting
              </h1>
              <p className="mt-4 text-lg text-text-secondary">
                Tell us your dream boat and our AI will match you with the best
                listings — even when you don&apos;t know exactly what you&apos;re
                looking for.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <MatchCTAPrimary
                  className="rounded-full bg-accent-btn px-8 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
                />
                <Link
                  href="/boats"
                  className="rounded-full border border-border-bright px-8 py-3 text-center text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
                >
                  Browse Boats Instead
                </Link>
              </div>
            </div>

            {/* Right — demo panel */}
            {boats.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-6">
                <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Preview — Example AI Match Results
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

      {/* How It Works */}
      <section className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold">How It Works</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-border bg-surface p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.Icon className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <p className="mt-2 text-xs font-semibold text-text-tertiary">Step {i + 1}</p>
                <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold">Why AI Matching?</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-surface p-8 transition-all hover:border-primary/30"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary/20">
                    <f.Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{f.title}</h3>
                    <p className="mt-2 text-sm text-text-secondary">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <BuyerPricing />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <h2 className="text-3xl font-bold">
            Ready to Find <span className="text-primary">The One</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-secondary">
            Create a free account, chat with our AI, and see your matches in
            minutes.
          </p>
          <MatchCTASecondary
            className="mt-8 inline-block rounded-full bg-accent-btn px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
          />
        </div>
      </section>
    </div>
  );
}
