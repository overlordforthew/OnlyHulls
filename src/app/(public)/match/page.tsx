import Link from "next/link";
import {
  Sailboat,
  MessageSquare,
  Target,
  Handshake,
  Sparkles,
  Shield,
  DollarSign,
} from "lucide-react";

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
    desc: "Our engine scores every listing against your unique profile using vector similarity and rule-based filters. Best matches float to the top.",
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
    desc: "The AI builds a rich profile from a natural conversation — not a tedious form. It picks up on preferences you might not even realize you have.",
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

export default function MatchPage() {
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
            AI-Powered Boat Matching
          </h1>
          <p className="mt-4 text-lg text-foreground/60">
            Tell us your dream boat and our AI will match you with the best
            listings — even when you don&apos;t know exactly what you&apos;re
            looking for.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up?role=buyer"
              className="rounded-full bg-primary px-8 py-3 text-center text-sm font-medium text-white hover:bg-primary-dark"
            >
              Get Matched — It&apos;s Free
            </Link>
            <Link
              href="/boats"
              className="rounded-full border border-border px-8 py-3 text-center text-sm font-medium text-foreground hover:bg-muted"
            >
              Browse Boats Instead
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold">How It Works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
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

      {/* Features */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-2xl font-bold">Why AI Matching?</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <f.Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-foreground/60">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
          <h2 className="text-2xl font-bold">Ready to Find Your Boat?</h2>
          <p className="mt-3 text-foreground/60">
            Create a free account, chat with our AI, and see your matches in
            minutes.
          </p>
          <Link
            href="/sign-up?role=buyer"
            className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Get Started — Free
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
