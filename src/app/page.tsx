import Link from "next/link";
import MobileNav from "@/components/MobileNav";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import HomeSearch from "@/components/HomeSearch";
import { getBoatCount } from "@/lib/db/queries";
import {
  Sailboat,
  Home as HomeIcon,
  Flag,
  Users,
  DollarSign,
  Landmark,
  Ship,
  Crosshair,
  ClipboardList,
} from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { label: "Cruising", Icon: Sailboat, tag: "bluewater" },
  { label: "Liveaboard", Icon: HomeIcon, tag: "liveaboard" },
  { label: "Racing", Icon: Flag, tag: "race-ready" },
  { label: "Family", Icon: Users, tag: "family-friendly" },
  { label: "Budget", Icon: DollarSign, tag: "budget-friendly" },
  { label: "Classic", Icon: Landmark, tag: "classic" },
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
        <div className="mx-auto flex max-w-7xl justify-center gap-8 overflow-x-auto px-6 py-4 sm:gap-12 lg:px-8">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.tag}
              href={`/boats?tag=${cat.tag}`}
              className="flex flex-col items-center gap-1.5 text-foreground/60 transition hover:text-primary"
            >
              <cat.Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
              <span className="whitespace-nowrap text-xs font-medium">
                {cat.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Main content — search left, right panel */}
      <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_1fr]">
          {/* Search Form — left aligned */}
          <div className="max-w-lg">
            <div className="rounded-xl border border-border bg-background p-6 shadow-lg sm:p-8">
              <HomeSearch />
            </div>
          </div>

          {/* Right side — action cards stacked */}
          <div className="flex flex-col gap-4">
            <Link
              href="/boats"
              className="flex items-center gap-4 rounded-xl border border-border p-5 transition hover:border-primary hover:shadow-md"
            >
              <Ship className="h-8 w-8 shrink-0 text-primary" strokeWidth={1.5} />
              <div>
                <h3 className="font-bold">Boats for Sale</h3>
                <p className="text-sm text-foreground/60">
                  Browse {count} listings worldwide
                </p>
              </div>
              <span className="ml-auto text-sm font-medium text-primary">
                View All →
              </span>
            </Link>
            <Link
              href="/sign-up?role=buyer"
              className="flex items-center gap-4 rounded-xl border border-border p-5 transition hover:border-primary hover:shadow-md"
            >
              <Crosshair className="h-8 w-8 shrink-0 text-primary" strokeWidth={1.5} />
              <div>
                <h3 className="font-bold">AI Matching</h3>
                <p className="text-sm text-foreground/60">
                  Tell us your dream boat, we&apos;ll find it
                </p>
              </div>
              <span className="ml-auto text-sm font-medium text-primary">
                Get Matched →
              </span>
            </Link>
            <Link
              href="/sign-up?role=seller"
              className="flex items-center gap-4 rounded-xl border border-border p-5 transition hover:border-primary hover:shadow-md"
            >
              <ClipboardList className="h-8 w-8 shrink-0 text-primary" strokeWidth={1.5} />
              <div>
                <h3 className="font-bold">Sell Your Boat</h3>
                <p className="text-sm text-foreground/60">
                  List for free — no commissions, no middlemen
                </p>
              </div>
              <span className="ml-auto text-sm font-medium text-primary">
                List Free →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Value Strip */}
      <section className="border-t border-border bg-muted/30 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-10 px-6 sm:gap-16 lg:px-8">
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
        <div className="mx-auto max-w-7xl px-6 text-sm text-foreground/50 lg:px-8">
          <p>OnlyHulls — AI-Powered Boat Matchmaking</p>
          <p className="mt-2 italic text-foreground/30">
            The OnlyFan of Boats, with plenty of Tinder
          </p>
        </div>
      </footer>
    </div>
  );
}
