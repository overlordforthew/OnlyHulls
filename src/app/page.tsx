import Link from "next/link";
import MobileNav from "@/components/MobileNav";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import HomeSearch from "@/components/HomeSearch";
import { getBoatCount } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { label: "Cruising", icon: "⛵", tag: "bluewater" },
  { label: "Liveaboard", icon: "🏠", tag: "liveaboard" },
  { label: "Racing", icon: "🏁", tag: "race-ready" },
  { label: "Family", icon: "👨‍👩‍👧", tag: "family-friendly" },
  { label: "Budget", icon: "💰", tag: "budget-friendly" },
  { label: "Classic", icon: "🏛️", tag: "classic" },
];

export default async function Home() {
  const count = await getBoatCount();

  return (
    <div className="min-h-screen">
      <ThemeSwitcher />

      {/* Header */}
      <header className="relative border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⛵</span>
            <span className="text-xl font-bold text-primary">OnlyHulls</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="/boats"
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Browse Boats
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/sign-in"
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Get Started
            </Link>
          </nav>
          <MobileNav />
        </div>
      </header>

      {/* Category Icon Strip */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-6 overflow-x-auto px-4 py-4 sm:gap-10">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.tag}
              href={`/boats?tag=${cat.tag}`}
              className="flex flex-col items-center gap-1.5 text-foreground/60 transition hover:text-primary"
            >
              <span className="text-2xl sm:text-3xl">{cat.icon}</span>
              <span className="whitespace-nowrap text-xs font-medium">
                {cat.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Search Form — centered */}
      <section className="flex justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-xl rounded-xl border border-border bg-background p-6 shadow-lg sm:p-8">
          <HomeSearch />
        </div>
      </section>

      {/* Action Cards */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-6 sm:grid-cols-3">
          <Link
            href="/boats"
            className="flex flex-col items-center rounded-xl border border-border p-8 text-center transition hover:border-primary hover:shadow-md"
          >
            <span className="text-4xl">⛵</span>
            <h3 className="mt-4 text-lg font-bold">Boats for Sale</h3>
            <span className="mt-2 text-sm font-medium text-primary">
              View All
            </span>
          </Link>
          <Link
            href="/sign-up?role=buyer"
            className="flex flex-col items-center rounded-xl border border-border p-8 text-center transition hover:border-primary hover:shadow-md"
          >
            <span className="text-4xl">🎯</span>
            <h3 className="mt-4 text-lg font-bold">AI Matching</h3>
            <span className="mt-2 text-sm font-medium text-primary">
              Get Matched
            </span>
          </Link>
          <Link
            href="/sign-up?role=seller"
            className="flex flex-col items-center rounded-xl border border-border p-8 text-center transition hover:border-primary hover:shadow-md"
          >
            <span className="text-4xl">📋</span>
            <h3 className="mt-4 text-lg font-bold">Sell Your Boat</h3>
            <span className="mt-2 text-sm font-medium text-primary">
              List Free
            </span>
          </Link>
        </div>
      </section>

      {/* Value Strip */}
      <section className="border-t border-border bg-muted/30 py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 text-center md:grid-cols-4">
          <div>
            <p className="text-2xl font-bold text-primary">$0</p>
            <p className="mt-1 text-sm text-foreground/60">Commission</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{count}</p>
            <p className="mt-1 text-sm text-foreground/60">Boats Listed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">AI</p>
            <p className="mt-1 text-sm text-foreground/60">Powered Matching</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">Global</p>
            <p className="mt-1 text-sm text-foreground/60">
              Worldwide Listings
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-foreground/50">
          <p>OnlyHulls — AI-Powered Boat Matchmaking</p>
          <p className="mt-2 italic text-foreground/30">
            Where you can be an OnlyFan of Boats, with plenty of Tinder
          </p>
        </div>
      </footer>
    </div>
  );
}
