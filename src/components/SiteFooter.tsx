import Link from "next/link";
import { Waves } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      {/* Gradient top accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Browse */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Browse
            </h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/boats" className="text-sm text-text-secondary hover:text-primary transition-colors">All Boats</Link></li>
              <li><Link href="/boats?tag=bluewater" className="text-sm text-text-secondary hover:text-primary transition-colors">Cruising</Link></li>
              <li><Link href="/boats?tag=liveaboard-ready" className="text-sm text-text-secondary hover:text-primary transition-colors">Liveaboard</Link></li>
              <li><Link href="/boats?tag=race-ready" className="text-sm text-text-secondary hover:text-primary transition-colors">Racing</Link></li>
              <li><Link href="/boats?tag=classic" className="text-sm text-text-secondary hover:text-primary transition-colors">Classic</Link></li>
            </ul>
          </div>

          {/* Sellers */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Sellers
            </h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/sell" className="text-sm text-text-secondary hover:text-primary transition-colors">List Your Boat</Link></li>
              <li><Link href="/sell#pricing" className="text-sm text-text-secondary hover:text-primary transition-colors">Seller Pricing</Link></li>
              <li><Link href="/sign-up?role=seller" className="text-sm text-text-secondary hover:text-primary transition-colors">Create Account</Link></li>
            </ul>
          </div>

          {/* Buyers */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Buyers
            </h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/match" className="text-sm text-text-secondary hover:text-primary transition-colors">AI Matching</Link></li>
              <li><Link href="/match#pricing" className="text-sm text-text-secondary hover:text-primary transition-colors">Buyer Plans</Link></li>
              <li><Link href="/sign-up?role=buyer" className="text-sm text-text-secondary hover:text-primary transition-colors">Get Started</Link></li>
            </ul>
          </div>

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-primary" strokeWidth={2.5} />
              <span className="text-lg font-bold">
                <span className="text-foreground">Only</span>
                <span className="text-primary">Hulls</span>
              </span>
            </div>
            <p className="mt-3 text-sm italic text-text-tertiary">
              The OnlyFans of Boats
            </p>
            <p className="mt-4 text-xs text-text-tertiary">
              No catfishing. Real boats. Real hulls.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-text-tertiary">
            &copy; {new Date().getFullYear()} OnlyHulls. All rights reserved.
          </p>
          <p className="text-xs text-text-tertiary">
            Zero commission. AI-powered. Built for boat lovers.
          </p>
        </div>
      </div>
    </footer>
  );
}
