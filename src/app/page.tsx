import Link from "next/link";
import {
  Sailboat,
  Home as HomeIcon,
  Flag,
  Users,
  DollarSign,
  Landmark,
  Eye,
  Heart,
  Handshake,
  Zap,
  Globe,
  Shield,
  Search,
  ArrowRight,
  Flame,
} from "lucide-react";
import BoatCard from "@/components/BoatCard";
import { ListBoatCTA } from "@/components/MatchCTA";
import SeoHubLinks from "@/components/seo/SeoHubLinks";
import { getBoatCount, getFeaturedBoats } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { label: "Cruising", Icon: Sailboat, tag: "bluewater" },
  { label: "Liveaboard", Icon: HomeIcon, tag: "liveaboard-ready" },
  { label: "Racing", Icon: Flag, tag: "race-ready" },
  { label: "Family", Icon: Users, tag: "family-friendly" },
  { label: "Budget", Icon: DollarSign, tag: "budget-friendly" },
  { label: "Classic", Icon: Landmark, tag: "classic" },
];

const STEPS = [
  {
    Icon: Eye,
    title: "Browse or Get Matched",
    desc: "Search manually or let our AI find boats that fit your style, budget, and dreams.",
  },
  {
    Icon: Heart,
    title: "Fall in Love",
    desc: "Swipe through matches, save your favorites, and build your dream shortlist.",
  },
  {
    Icon: Handshake,
    title: "Connect Directly",
    desc: "Message sellers with zero middlemen. No broker fees. No commission. Ever.",
  },
];

const VALUES = [
  {
    Icon: DollarSign,
    stat: "$0",
    title: "Commission",
    desc: "We never take a cut. Buy and sell without losing a dime to fees.",
  },
  {
    Icon: Zap,
    stat: "AI",
    title: "Powered Matching",
    desc: "Our AI builds your buyer profile and scores every listing against it.",
  },
  {
    Icon: Shield,
    stat: "No",
    title: "Brokers Required",
    desc: "Connect directly with sellers. No gatekeepers, no middlemen.",
  },
  {
    Icon: Globe,
    stat: "Global",
    title: "Reach",
    desc: "Boats from everywhere. The right buyer finds the right boat, worldwide.",
  },
];

export default async function Home() {
  const [count, boats] = await Promise.all([
    getBoatCount(),
    getFeaturedBoats(6),
  ]);

  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden pb-16 pt-12 sm:pb-24 sm:pt-20">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-5">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Find Your Perfect{" "}
              <span className="text-primary">Hull</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-text-secondary sm:text-xl">
              The boat marketplace that actually doesn&apos;t suck.{" "}
              <br className="hidden sm:block" />
              AI-powered. Zero commission. Built for boat lovers.
            </p>

            {/* Search bar */}
            <form
              action="/boats"
              className="mx-auto mt-10 flex max-w-lg overflow-hidden rounded-full border border-border-bright bg-surface shadow-lg shadow-black/20"
            >
              <div className="flex flex-1 items-center gap-3 px-5">
                <Search className="h-5 w-5 shrink-0 text-text-tertiary" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search boats..."
                  className="w-full bg-transparent py-3.5 text-sm text-foreground placeholder:text-text-tertiary focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="m-1.5 rounded-full bg-accent-btn px-6 text-sm font-semibold text-white transition-all hover:bg-accent-light"
              >
                Search
              </button>
            </form>

            {/* CTA buttons */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/boats"
                className="rounded-full bg-primary-btn px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-light hover:shadow-lg hover:shadow-primary/20"
              >
                Browse All Boats
              </Link>
              <Link
                href="/match"
                className="rounded-full border border-border-bright px-8 py-3 text-sm font-semibold text-foreground transition-all hover:border-primary hover:text-primary"
              >
                Get Matched by AI
              </Link>
            </div>

            {/* Stats strip */}
            <div className="mx-auto mt-12 flex max-w-md justify-center gap-8 sm:gap-12">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary sm:text-3xl">{count}</p>
                <p className="mt-1 text-xs text-text-secondary">Boats Listed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary sm:text-3xl">$0</p>
                <p className="mt-1 text-xs text-text-secondary">Commission</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary sm:text-3xl">AI</p>
                <p className="mt-1 text-xs text-text-secondary">Matching</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Categories ─── */}
      <section className="border-y border-border bg-surface/50">
        <div className="mx-auto flex max-w-7xl justify-center gap-6 overflow-x-auto px-5 py-5 no-scrollbar sm:gap-10">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.tag}
              href={`/boats?tag=${cat.tag}`}
              className="flex flex-col items-center gap-2 rounded-xl px-4 py-3 text-text-secondary transition-all hover:bg-muted hover:text-primary"
            >
              <cat.Icon className="h-7 w-7" strokeWidth={1.5} />
              <span className="whitespace-nowrap text-xs font-medium">{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <SeoHubLinks />

      {/* ─── Trending Hulls ─── */}
      {boats.length > 0 && (
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <Flame className="h-6 w-6 text-accent" />
                Trending Hulls
              </h2>
              <Link
                href="/boats"
                className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-light"
              >
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {boats.slice(0, 6).map((boat) => (
                <BoatCard key={boat.id} boat={boat} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── How It Works ─── */}
      <section className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            How <span className="text-primary">OnlyHulls</span> Works
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-text-secondary">
            Three steps to your next boat. No brokers, no BS.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="group rounded-2xl border border-border bg-surface p-8 text-center transition-all hover:border-primary/30"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-all group-hover:bg-primary/20 group-hover:shadow-lg group-hover:shadow-primary/10">
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

      {/* ─── Why OnlyHulls ─── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            Why Boat Lovers Choose <span className="text-primary">OnlyHulls</span>
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="group rounded-2xl border border-border bg-surface p-8 transition-all hover:border-primary/30"
              >
                <div className="flex items-start gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary/20">
                    <v.Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-primary">{v.stat}</p>
                    <h3 className="mt-1 text-lg font-bold">{v.title}</h3>
                    <p className="mt-2 text-sm text-text-secondary">{v.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Become a Creator (Seller CTA) ─── */}
      <section className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border-bright bg-surface p-10 text-center sm:p-14">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Show Us Your <span className="text-primary">Hull</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-text-secondary">
              List your boat for free. Our AI connects you with qualified buyers
              worldwide. No commission, no brokers, no middlemen.
            </p>
            <ListBoatCTA
              className="mt-8 inline-block rounded-full bg-accent-btn px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
            />
            <p className="mt-3 text-xs text-text-tertiary">
              No credit card required. List in under 5 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Ready to Make <span className="text-primary">Waves</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-secondary">
            Join the boat marketplace that puts you first.
            Zero fees. Real boats. Real connections.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="rounded-full bg-primary-btn px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-light hover:shadow-lg hover:shadow-primary/20"
            >
              Get Started — It&apos;s Free
            </Link>
            <Link
              href="/boats"
              className="rounded-full border border-border-bright px-8 py-3 text-sm font-semibold text-foreground transition-all hover:border-primary hover:text-primary"
            >
              Browse Boats
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
