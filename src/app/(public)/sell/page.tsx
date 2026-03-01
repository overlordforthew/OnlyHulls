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

export default function SellPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">⛵</span>
            <span className="text-xl font-bold text-primary">OnlyHulls</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/boats"
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Browse Boats
            </Link>
            <Link
              href="/sign-in"
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sell Your Boat — Zero Commission
          </h1>
          <p className="mt-4 text-lg text-foreground/60">
            List your boat on OnlyHulls and let our AI connect you with
            qualified buyers. No brokers, no middlemen, no percentage of your
            sale.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up?role=seller"
              className="rounded-full bg-primary px-8 py-3 text-center text-sm font-medium text-white hover:bg-primary-dark"
            >
              List Your Boat
            </Link>
            <a
              href="#pricing"
              className="rounded-full border border-border px-8 py-3 text-center text-sm font-medium text-foreground hover:bg-muted"
            >
              See Pricing
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold">How Selling Works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-semibold">
                    <span className="text-primary">{i + 1}.</span>{" "}
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-foreground/60">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold">Why Sell on OnlyHulls?</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <b.Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-semibold">{b.title}</h3>
                  <p className="mt-1 text-sm text-foreground/60">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="border-t border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold">OnlyHulls vs. Traditional Brokers</h2>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 pr-8 font-semibold"></th>
                  <th className="pb-3 pr-8 font-semibold text-primary">
                    OnlyHulls
                  </th>
                  <th className="pb-3 font-semibold text-foreground/60">
                    Traditional Broker
                  </th>
                </tr>
              </thead>
              <tbody className="text-foreground/70">
                <tr className="border-b border-border/50">
                  <td className="py-3 pr-8 font-medium text-foreground">Commission</td>
                  <td className="py-3 pr-8 font-semibold text-primary">$0</td>
                  <td className="py-3">8–10% of sale price</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 pr-8 font-medium text-foreground">Listing fee</td>
                  <td className="py-3 pr-8 font-semibold text-primary">Free</td>
                  <td className="py-3">$200–500+</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 pr-8 font-medium text-foreground">Buyer matching</td>
                  <td className="py-3 pr-8 font-semibold text-primary">AI-powered</td>
                  <td className="py-3">Manual, limited network</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3 pr-8 font-medium text-foreground">Reach</td>
                  <td className="py-3 pr-8 font-semibold text-primary">Global</td>
                  <td className="py-3">Local / regional</td>
                </tr>
                <tr>
                  <td className="py-3 pr-8 font-medium text-foreground">Time to list</td>
                  <td className="py-3 pr-8 font-semibold text-primary">Minutes</td>
                  <td className="py-3">Days to weeks</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <SellerPricing />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold">Ready to Sell?</h2>
          <p className="mt-3 text-foreground/60">
            Create a free account and list your boat in minutes. No credit card
            required.
          </p>
          <Link
            href="/sign-up?role=seller"
            className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary-dark"
          >
            List Your Boat — Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-7xl px-6 text-sm text-foreground/50 lg:px-8">
          <p>OnlyHulls — AI-Powered Boat Matchmaking</p>
        </div>
      </footer>
    </div>
  );
}
