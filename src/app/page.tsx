import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⛵</span>
            <span className="text-xl font-bold text-primary">OnlyHulls</span>
          </div>
          <nav className="flex items-center gap-6">
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
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Find Your Perfect Boat
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium uppercase tracking-[0.25em] text-primary/70">
          Where OnlyFans, Tinder and Boats Collide
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-foreground/60">
          AI-powered matchmaking connects you with the right boat — even when
          you don&apos;t know exactly what you&apos;re looking for.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/sign-up?role=buyer"
            className="rounded-full bg-primary px-8 py-3 text-lg font-medium text-white hover:bg-primary-dark"
          >
            I&apos;m Looking for a Boat
          </Link>
          <Link
            href="/sign-up?role=seller"
            className="rounded-full border border-border px-8 py-3 text-lg font-medium text-foreground hover:bg-muted"
          >
            I&apos;m Selling a Boat
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted py-24">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold">How It Works</h2>
          <div className="mt-16 grid gap-12 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
                💬
              </div>
              <h3 className="mt-6 text-xl font-semibold">
                Tell Us About Your Dream
              </h3>
              <p className="mt-3 text-foreground/60">
                Chat with our AI to build your buyer profile. It learns what you
                need, even the things you haven&apos;t thought of yet.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
                🎯
              </div>
              <h3 className="mt-6 text-xl font-semibold">Get Matched</h3>
              <p className="mt-3 text-foreground/60">
                Our engine scores every listing against your unique profile. Best
                matches float to the top.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
                🤝
              </div>
              <h3 className="mt-6 text-xl font-semibold">Connect Directly</h3>
              <p className="mt-3 text-foreground/60">
                Found the one? Connect directly with the seller. No brokers, no
                middlemen, no 10% commission.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h2 className="text-3xl font-bold">Why OnlyHulls?</h2>
          <div className="mt-16 grid gap-8 md:grid-cols-4">
            <div>
              <p className="text-4xl font-bold text-primary">$0</p>
              <p className="mt-2 text-foreground/60">Commission fees</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-primary">AI</p>
              <p className="mt-2 text-foreground/60">Powered matching</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-primary">30-55ft</p>
              <p className="mt-2 text-foreground/60">Cruising sailboats</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-primary">Global</p>
              <p className="mt-2 text-foreground/60">Worldwide listings</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-foreground/50">
          <p>OnlyHulls — AI-Powered Boat Matchmaking</p>
          <p className="mt-2">
            Be the matchmaker, not the broker. Low barrier, community first.
          </p>
        </div>
      </footer>
    </div>
  );
}
