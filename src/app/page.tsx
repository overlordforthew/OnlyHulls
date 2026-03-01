import Link from "next/link";
import MobileNav from "@/components/MobileNav";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import HomeSearch from "@/components/HomeSearch";
import BoatCard from "@/components/BoatCard";
import { getFeaturedBoats, getRecentBoats, getBoatCount } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { label: "Bluewater", emoji: "🌊", tag: "bluewater" },
  { label: "Liveaboard", emoji: "🏠", tag: "liveaboard" },
  { label: "Budget", emoji: "💰", tag: "budget-friendly" },
  { label: "Race Ready", emoji: "🏁", tag: "race-ready" },
  { label: "Family", emoji: "👨‍👩‍👧", tag: "family-friendly" },
  { label: "Classic", emoji: "🏛️", tag: "classic" },
];

export default async function Home() {
  const [featured, count] = await Promise.all([
    getFeaturedBoats(6),
    getBoatCount(),
  ]);
  const featuredIds = featured.map((b) => b.id);
  const recent = await getRecentBoats(6, featuredIds);

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
          {/* Desktop nav */}
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
          {/* Mobile nav */}
          <MobileNav />
        </div>
      </header>

      {/* Hero — compact */}
      <section className="mx-auto max-w-7xl px-4 py-12 text-center sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          Find Your Perfect Boat
        </h1>
        <div className="mt-8">
          <HomeSearch />
        </div>
        <p className="mt-4 text-sm text-foreground/50">
          {count} boats listed &nbsp;·&nbsp; AI-powered matching &nbsp;·&nbsp; $0 commissions
        </p>
      </section>

      {/* Category Tiles */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="flex flex-wrap justify-center gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.tag}
              href={`/boats?tag=${cat.tag}`}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground/80 transition hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Boats */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold sm:text-2xl">Featured Boats</h2>
            <Link
              href="/boats"
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              View All →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((boat) => (
              <BoatCard key={boat.id} boat={boat} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Listed */}
      {recent.length > 0 && (
        <section className="bg-muted py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold sm:text-2xl">Recently Listed</h2>
              <Link
                href="/boats"
                className="text-sm font-medium text-primary hover:text-primary-dark"
              >
                View All →
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((boat) => (
                <BoatCard key={boat.id} boat={boat} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Value Strip */}
      <section className="py-12">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 text-center md:grid-cols-4">
          <div>
            <p className="text-2xl font-bold text-primary">$0</p>
            <p className="mt-1 text-sm text-foreground/60">Commission</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">AI</p>
            <p className="mt-1 text-sm text-foreground/60">Matching</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">All Types</p>
            <p className="mt-1 text-sm text-foreground/60">Sail, Power & More</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">Global</p>
            <p className="mt-1 text-sm text-foreground/60">Worldwide Listings</p>
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
