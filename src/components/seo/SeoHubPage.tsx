import Link from "next/link";
import { getLocale } from "next-intl/server";
import BoatCard from "@/components/BoatCard";
import {
  getSeoHubPageCopy,
  localizeSeoHubDefinition,
  localizeSeoHubLink,
} from "@/i18n/copy/seo";
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

export default async function SeoHubPage({ hub, boats, total }: SeoHubPageProps) {
  const locale = await getLocale();
  const copy = getSeoHubPageCopy(locale);
  const localizedHub = localizeSeoHubDefinition(locale, hub);
  const localizedRelatedLinks = localizedHub.relatedLinks.map((link) =>
    localizeSeoHubLink(locale, link)
  );
  const collectionSchema = buildHubCollectionSchema(localizedHub, boats, total);
  const breadcrumbSchema = buildHubBreadcrumbSchema(localizedHub);
  const lowInventory = boats.length > 0 && boats.length < 6;

  return (
    <div className="pb-16">
      <JsonLdScript data={collectionSchema} />
      <JsonLdScript data={breadcrumbSchema} />

      <section className="border-b border-border bg-surface/40 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {localizedHub.eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            {localizedHub.heading}
          </h1>
          <p className="mt-4 max-w-3xl text-base text-text-secondary sm:text-lg">
            {localizedHub.intro}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-primary/10 px-3 py-1.5 font-medium text-primary">
              {copy.liveListings(total)}
            </span>
            <Link
              href="/boats"
              className="rounded-full border border-border px-4 py-1.5 font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {copy.browseAllBoats}
            </Link>
            <Link
              href="/match"
              className="rounded-full border border-border px-4 py-1.5 font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {copy.getAiMatched}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-10">
        {boats.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-8 text-center">
            <h2 className="text-xl font-semibold">{copy.noBoatsTitle}</h2>
            <p className="mt-2 text-text-secondary">
              {copy.noBoatsDescription}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/boats"
                className="rounded-full bg-primary-btn px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
              >
                {copy.browseAllBoats}
              </Link>
              <Link
                href="/match"
                className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {copy.getAiMatched}
              </Link>
            </div>
            <div className="mt-8 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
              {localizedRelatedLinks.slice(0, 3).map((link) => (
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
                <h2 className="text-xl font-semibold">{copy.broaderSearchHeading}</h2>
                <p className="mt-3 text-sm leading-7 text-text-secondary">
                  {copy.broaderSearchDescription}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/boats"
                    className="rounded-full bg-primary-btn px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-primary-light"
                  >
                    {copy.browseAllBoats}
                  </Link>
                  <Link
                    href="/match"
                    className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {copy.getAiMatched}
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
              <h2 className="text-xl font-semibold">{copy.whyPageMattersHeading}</h2>
              <p className="mt-3 text-sm leading-7 text-text-secondary">
                {copy.whyPageMattersDescription}
              </p>
            </div>
          </>
        )}
      </section>

      <section className="mx-auto mt-14 max-w-7xl px-5">
        <div className="rounded-2xl border border-border bg-surface/30 p-6">
          <h2 className="text-xl font-semibold">{copy.relatedBoatSearches}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {localizedRelatedLinks.map((link) => (
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
