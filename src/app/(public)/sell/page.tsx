import Link from "next/link";
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
import { SellerPricing } from "@/components/PricingCards";

export const metadata = {
  title: "Sell Your Boat",
  description:
    "List your boat on OnlyHulls. No commissions, no brokers — connect directly with AI-matched buyers worldwide.",
};

const STEPS = [
  {
    Icon: ClipboardList,
    title: "Create Your Listing",
    desc: "Enter your boat's details — make, model, specs, condition, and price. Our guided wizard walks you through it step by step.",
  },
  {
    Icon: Camera,
    title: "Add Photos",
    desc: "Upload photos to showcase your boat. Great photos get more interest — we'll help you pick the best ones.",
  },
  {
    Icon: Zap,
    title: "AI Does the Work",
    desc: "Our AI analyzes your listing, tags it with character traits (bluewater, liveaboard, race-ready), and matches it with qualified buyers.",
  },
  {
    Icon: Users,
    title: "Connect with Buyers",
    desc: "When a buyer is interested, you connect directly. No broker in the middle, no commission on the sale.",
  },
];

const BENEFITS = [
  {
    Icon: DollarSign,
    title: "$0 Commission",
    desc: "Keep every dollar of your sale. We never take a cut — listing and matching are free.",
  },
  {
    Icon: Globe,
    title: "Global Reach",
    desc: "Your listing is visible to buyers worldwide. AI matching means the right buyers find you, not just the local ones.",
  },
  {
    Icon: Shield,
    title: "You Stay in Control",
    desc: "You decide who to talk to and when. No cold calls from brokers, no pressure to accept lowball offers.",
  },
  {
    Icon: Clock,
    title: "List in Minutes",
    desc: "Our step-by-step wizard makes it fast. Enter the basics, add photos, and you're live.",
  },
];

const COMPARISON = [
  { feature: "Commission", us: "$0", them: "8–10% of sale price" },
  { feature: "Listing Fee", us: "Free", them: "$200–500+" },
  { feature: "Buyer Matching", us: "AI-powered", them: "Manual, limited" },
  { feature: "Reach", us: "Global", them: "Local / regional" },
  { feature: "Time to List", us: "Minutes", them: "Days to weeks" },
];

export default function SellPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden pb-16 pt-12 sm:pb-20 sm:pt-16">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
          <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-accent/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              <Zap className="h-3 w-3" />
              For Sellers
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Become a{" "}
              <span className="text-primary">Creator</span>
            </h1>
            <p className="mt-4 text-lg text-text-secondary">
              Show us your hull. List your boat for free and let our AI connect
              you with qualified buyers worldwide. No brokers, no middlemen, no
              percentage of your sale.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up?role=seller"
                className="rounded-full bg-accent px-8 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
              >
                List Your Boat — Free
              </Link>
              <a
                href="#pricing"
                className="rounded-full border border-border-bright px-8 py-3 text-center text-sm font-medium text-foreground transition-all hover:border-primary hover:text-primary"
              >
                See Pricing
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How Selling Works */}
      <section className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold">How Selling Works</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-border bg-surface p-8 transition-all hover:border-primary/30">
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
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold">
            Why Sell on <span className="text-primary">OnlyHulls</span>?
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="group rounded-2xl border border-border bg-surface p-8 transition-all hover:border-primary/30"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary/20">
                    <b.Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{b.title}</h3>
                    <p className="mt-2 text-sm text-text-secondary">{b.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold">
            OnlyHulls vs. Traditional Brokers
          </h2>
          <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="px-6 py-4 font-semibold text-text-secondary"></th>
                  <th className="px-6 py-4 font-semibold text-primary">OnlyHulls</th>
                  <th className="px-6 py-4 font-semibold text-text-tertiary">Broker</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "bg-surface-elevated" : "bg-surface"}`}>
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

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <SellerPricing />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface/30 py-20">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <h2 className="text-3xl font-bold">
            Ready to Show Us Your <span className="text-primary">Hull(s)</span>!?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-secondary">
            Create a free account and list your boat in minutes. No credit card
            required.
          </p>
          <Link
            href="/sign-up?role=seller"
            className="mt-8 inline-block rounded-full bg-accent px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
          >
            List Your Boat — Free
          </Link>
        </div>
      </section>
    </div>
  );
}
