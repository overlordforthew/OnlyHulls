import Link from "next/link";
import BoatCard from "@/components/BoatCard";
import JsonLdScript from "@/components/JsonLdScript";
import type { BoatRow } from "@/lib/db/queries";
import {
  buildHubBreadcrumbSchema,
  buildHubCollectionSchema,
  type SeoHubDefinition,
} from "@/lib/seo/hubs";

interface SeoHubPageProps {
  hub: SeoHubDefinition;
  boats: BoatRow[];
  total: number;
}

export default function SeoHubPage({ hub, boats, total }: SeoHubPageProps) {
  const collectionSchema = buildHubCollectionSchema(hub, boats, total);
  const breadcrumbSchema = buildHubBreadcrumbSchema(hub);
  const lowInventory = boats.length > 0 && boats.length < 6;

  return (
    <div className="pb-16">
      <JsonLdScript data={collectionSchema} />
      <JsonLdScript data={breadcrumbSchema} />

      <section className="border-b border-border bg-surface/40 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {hub.eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            {hub.heading}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-text-secondary sm:text-lg">
            {hub.intro}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-primary/10 px-3 py-1.5 font-medium text-primary">
              {total.toLocaleString("en-US")} {hub.countLabel}
            </span>
            <Link
              href="/boats"
              className="rounded-full border border-border px-4 py-1.5 font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Browse all boats
            </Link>
            <Link
              href="/match"
              className="rounded-full border border-border px-4 py-1.5 font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Get AI matched
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-10">
        {boats.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <h2 className="text-xl font-semibold">No boats are live on this hub yet</h2>
            <p className="mt-2 text-text-secondary">
              The page is ready, but the current catalog does not have enough clean live listings here yet.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/boats"
                className="rounded-full bg-primary-btn px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
              >
                Browse all boats
              </Link>
              <Link
                href="/match"
                className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                Get AI matched
              </Link>
            </div>
            <div className="mt-8 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
              {hub.relatedLinks.slice(0, 3).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-border bg-background/40 px-4 py-4 transition-all hover:border-primary/30"
                >
                  <p className="font-medium text-foreground">{link.label}</p>
                  <p className="mt-1 text-sm text-text-secondary">{link.description}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {boats.map((boat) => (
                <BoatCard key={boat.id} boat={boat} />
              ))}
            </div>

            {lowInventory && (
              <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
                <h2 className="text-xl font-semibold">Need a broader search?</h2>
                <p className="mt-3 text-sm leading-7 text-text-secondary">
                  This hub is live but still narrow. If you want more options right now, open a wider browse page or let the matcher fan out to nearby markets.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/boats"
                    className="rounded-full bg-primary-btn px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
                  >
                    Browse all boats
                  </Link>
                  <Link
                    href="/match"
                    className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    Get AI matched
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
              <h2 className="text-xl font-semibold">Why this page matters</h2>
              <p className="mt-3 text-sm leading-7 text-text-secondary">
                OnlyHulls uses hub pages like this to keep strong inventory clusters in one crawlable place.
                Buyers can browse cleaner listings faster, and search engines get a stable URL with real market intent
                instead of a temporary filtered query string.
              </p>
            </div>
          </>
        )}
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-5">
        <div className="rounded-2xl border border-border bg-surface/30 p-6">
          <h2 className="text-xl font-semibold">Related boat searches</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hub.relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-border bg-surface px-4 py-4 transition-all hover:border-primary/30"
              >
                <p className="font-medium text-foreground">{link.label}</p>
                <p className="mt-1 text-sm text-text-secondary">{link.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
