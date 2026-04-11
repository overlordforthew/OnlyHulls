import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft, MapPin, Sparkles, User } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildVisibleImportQualitySql, hasUsableImportedLocation } from "@/lib/import-quality";
import { ContactOwnerCTA } from "@/components/MatchCTA";
import BoatCard from "@/components/BoatCard";
import CurrencySelector from "@/components/CurrencySelector";
import { ImageGallery } from "@/components/ImageGallery";
import { getDisplayedPrice, normalizeSupportedCurrency } from "@/lib/currency";
import { getPublicAppUrl } from "@/lib/config/urls";
import SeoHubLinks from "@/components/seo/SeoHubLinks";
import { getRelatedBoats } from "@/lib/db/queries";
import { getRelevantSeoHubLinksForBoat } from "@/lib/seo/hubs";

interface BoatDetail {
  id: string;
  seller_id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  status: string;
  location_text: string | null;
  slug: string | null;
  is_sample: boolean;
  seller_name: string | null;
  seller_subscription_tier: string | null;
  specs: Record<string, unknown>;
  character_tags: string[];
  condition_score: number | null;
  ai_summary: string | null;
  asking_price_usd: number | null;
  source_url: string | null;
  source_site: string | null;
  hero_url: string | null;
}

function buildBoatTitle(boat: Pick<BoatDetail, "year" | "make" | "model">) {
  return `${boat.year} ${boat.make} ${boat.model}`;
}

function trimMetaDescription(text: string, maxLength = 160) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function toAbsoluteUrl(url: string | null | undefined, appUrl: string) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${appUrl}${url}`;
  return `${appUrl}/${url}`;
}

function buildBoatMetaDescription(boat: BoatDetail, priceStr: string) {
  const title = buildBoatTitle(boat);
  const location = boat.location_text ? ` in ${boat.location_text}` : "";
  const summary = boat.ai_summary?.trim();
  if (summary) {
    return trimMetaDescription(`${title} for sale${location}. ${summary}`);
  }

  return trimMetaDescription(
    `${title} boat for sale${location} on OnlyHulls. View price, photos, specs, and seller contact details. Listed at ${priceStr}.`
  );
}

async function getPublicBoat(slug: string): Promise<BoatDetail | null> {
  return queryOne<BoatDetail>(
    `SELECT b.id, b.seller_id, b.make, b.model, b.year, b.asking_price, b.currency, b.status, b.asking_price_usd,
            b.location_text, b.slug, b.is_sample, b.source_url, b.source_site,
            u.display_name as seller_name,
            COALESCE(u.subscription_tier::text, 'free') as seller_subscription_tier,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.condition_score, d.ai_summary,
            (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     LEFT JOIN users u ON u.id = b.seller_id
     WHERE (b.slug = $1 OR b.id::text = $1)
       AND b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}`,
    [slug]
  );
}

async function getBoatForViewer(
  slug: string,
  viewerId: string | null,
  viewerRole: string | null
): Promise<BoatDetail | null> {
  const boat = await queryOne<BoatDetail>(
    `SELECT b.id, b.seller_id, b.make, b.model, b.year, b.asking_price, b.currency, b.status, b.asking_price_usd,
            b.location_text, b.slug, b.is_sample, b.source_url, b.source_site,
            u.display_name as seller_name,
            COALESCE(u.subscription_tier::text, 'free') as seller_subscription_tier,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.condition_score, d.ai_summary,
            (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     LEFT JOIN users u ON u.id = b.seller_id
     WHERE (b.slug = $1 OR b.id::text = $1)`,
    [slug]
  );

  if (!boat) {
    return null;
  }

  if (boat.status === "active") {
    if (
      boat.source_url &&
      (
        !boat.hero_url ||
        !boat.model.trim() ||
        !hasUsableImportedLocation(boat.location_text) ||
        Number(boat.asking_price_usd || boat.asking_price) < 3000
      )
    ) {
      return null;
    }
    return boat;
  }

  if (viewerRole === "admin" || boat.seller_id === viewerId) {
    return boat;
  }

  return null;
}

async function getBoatMedia(boatId: string) {
  return query<{
    id: string;
    type: "image" | "video";
    url: string;
    thumbnail_url: string | null;
    caption: string | null;
  }>(
    `SELECT id, type, url, thumbnail_url, caption
     FROM boat_media
     WHERE boat_id = $1
     ORDER BY sort_order`,
    [boatId]
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const boat = await getPublicBoat(slug);
  if (!boat) return { title: "Boat Not Found" };

  const appUrl = getPublicAppUrl();
  const canonicalUrl = `${appUrl}/boats/${slug}`;
  const boatTitle = buildBoatTitle(boat);
  const heroImage = toAbsoluteUrl(boat.hero_url, appUrl);
  const priceStr = boat.asking_price_usd
    ? `$${Math.round(boat.asking_price_usd).toLocaleString("en-US")}`
    : `$${Math.round(boat.asking_price).toLocaleString("en-US")} ${boat.currency}`;
  const title = boat.location_text
    ? `${boatTitle} for sale in ${boat.location_text}`
    : `${boatTitle} for sale`;
  const description = buildBoatMetaDescription(boat, priceStr);
  const keywords = [
    boat.make,
    boat.model,
    String(boat.year),
    "boat for sale",
    "OnlyHulls",
    ...boat.character_tags,
    ...(boat.location_text ? [boat.location_text] : []),
  ];

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "article",
      title: `${title} | OnlyHulls`,
      description,
      url: canonicalUrl,
      ...(heroImage && { images: [{ url: heroImage, alt: boatTitle }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | OnlyHulls`,
      description,
      ...(heroImage && { images: [heroImage] }),
    },
  };
}

export default async function BoatDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const preferredCurrency = normalizeSupportedCurrency(
    cookieStore.get("preferred_currency")?.value
  );
  const viewer = await getCurrentUser();
  const boat = await getBoatForViewer(slug, viewer?.id ?? null, viewer?.role ?? null);
  if (!boat) notFound();
  const appUrl = getPublicAppUrl();
  const boatUrl = `${appUrl}/boats/${slug}`;

  if (boat.status === "active") {
    query(`UPDATE boats SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = $1`, [
      boat.id,
    ]).catch(() => {});
  }

  const [media, relatedBoats] = await Promise.all([
    getBoatMedia(boat.id),
    getRelatedBoats({
      boatId: boat.id,
      make: boat.make,
      locationText: boat.location_text,
      characterTags: boat.character_tags,
      priceUsd: boat.asking_price_usd ?? boat.asking_price,
      limit: 3,
    }),
  ]);
  const specs = boat.specs as Record<string, unknown>;
  const sellerInitial = boat.seller_name?.[0]?.toUpperCase() || "S";
  const relatedHubLinks = getRelevantSeoHubLinksForBoat({
    make: boat.make,
    locationText: boat.location_text,
    characterTags: boat.character_tags,
  });
  const displayedPrice = getDisplayedPrice({
    amount: boat.asking_price,
    nativeCurrency: boat.currency,
    amountUsd: boat.asking_price_usd,
    preferredCurrency,
  });
  const boatTitle = buildBoatTitle(boat);
  const imageUrls = media
    .filter((mediaItem) => mediaItem.type === "image")
    .slice(0, 8)
    .map((mediaItem) => toAbsoluteUrl(mediaItem.url, appUrl))
    .filter((url): url is string => Boolean(url));
  const listingSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: boatTitle,
    category: "Boat",
    model: boat.model,
    sku: boat.id,
    description: buildBoatMetaDescription(
      boat,
      boat.asking_price_usd
        ? `$${Math.round(boat.asking_price_usd).toLocaleString("en-US")}`
        : `${boat.currency} ${Math.round(boat.asking_price).toLocaleString("en-US")}`
    ),
    ...(imageUrls.length > 0 && { image: imageUrls }),
    brand: { "@type": "Brand", name: boat.make },
    offers: {
      "@type": "Offer",
      price: boat.asking_price,
      priceCurrency: boat.currency,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      url: boatUrl,
      seller: {
        "@type": "Organization",
        name: boat.source_url
          ? formatSourceSite(boat.source_site)
          : boat.seller_name || "OnlyHulls Seller",
      },
    },
    ...(boat.location_text && {
      availableAtOrFrom: {
        "@type": "Place",
        name: boat.location_text,
      },
    }),
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "OnlyHulls",
        item: appUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Browse Boats",
        item: `${appUrl}/boats`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: boatTitle,
        item: boatUrl,
      },
    ],
  };

  return (
    <div className="pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(listingSchema).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c"),
        }}
      />

      <div className="border-b border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <Link
            href="/boats"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Browse
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pt-6">
        <ImageGallery media={media} alt={`${boat.make} ${boat.model}`} />

        {boat.status !== "active" && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              boat.status === "pending_review"
                ? "border-accent/20 bg-accent/10 text-accent"
                : "border-red-500/20 bg-red-500/10 text-red-300"
            }`}
          >
            {boat.status === "pending_review"
              ? "Preview mode: this listing is pending review and is only visible to the seller and admins."
              : "Preview mode: this listing is not live to buyers right now."}
          </div>
        )}

        {boat.is_sample && (
          <div className="mt-4 rounded-lg border border-accent/20 bg-accent/10 px-4 py-2 text-sm text-accent">
            This is a sample listing for demonstration purposes.
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div>
              <h1 className="text-3xl font-bold">{`${boat.year} ${boat.make} ${boat.model}`}</h1>
              {boat.location_text && (
                <p className="mt-2 flex items-center gap-1.5 text-text-secondary">
                  <MapPin className="h-4 w-4" />
                  {boat.location_text}
                </p>
              )}
              <div className="mt-3">
                <CurrencySelector
                  id="boat-detail-currency"
                  value={preferredCurrency}
                  refreshOnChange
                />
              </div>
              <p className="mt-3 text-3xl font-bold">{displayedPrice.primary}</p>
              {displayedPrice.secondary && (
                <p className="mt-1 text-base text-text-secondary">{displayedPrice.secondary}</p>
              )}
            </div>

            {boat.ai_summary && (
              <div className="rounded-xl border-l-4 border-primary bg-surface p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  Listing Description
                </div>
                <p className="mt-3 whitespace-pre-wrap leading-relaxed text-foreground/80">
                  {boat.ai_summary}
                </p>
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold">Specifications</h2>
              <div className="mt-4 grid grid-cols-2 gap-1">
                {specs.loa ? <SpecRow label="LOA" value={`${specs.loa}ft`} /> : null}
                {specs.beam ? <SpecRow label="Beam" value={`${specs.beam}ft`} /> : null}
                {specs.draft ? <SpecRow label="Draft" value={`${specs.draft}ft`} /> : null}
                {specs.rig_type ? <SpecRow label="Rig Type" value={String(specs.rig_type)} /> : null}
                {specs.hull_material ? <SpecRow label="Hull" value={String(specs.hull_material)} /> : null}
                {specs.engine ? <SpecRow label="Engine" value={String(specs.engine)} /> : null}
                {specs.cabins ? <SpecRow label="Cabins" value={String(specs.cabins)} /> : null}
                {specs.berths ? <SpecRow label="Berths" value={String(specs.berths)} /> : null}
                {specs.heads ? <SpecRow label="Heads" value={String(specs.heads)} /> : null}
                {specs.displacement ? (
                  <SpecRow
                    label="Displacement"
                    value={`${Number(specs.displacement).toLocaleString()} kg`}
                  />
                ) : null}
                {specs.keel_type ? <SpecRow label="Keel" value={String(specs.keel_type)} /> : null}
                {specs.fuel_type ? <SpecRow label="Fuel" value={String(specs.fuel_type)} /> : null}
              </div>
            </div>

            {boat.character_tags.length > 0 && (
              <div>
                <h3 className="font-semibold">Character</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {boat.character_tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-3 py-1.5 text-sm text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-surface p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {boat.source_url ? (
                    <Sparkles className="h-5 w-5" />
                  ) : boat.seller_name ? (
                    sellerInitial
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">
                    {boat.source_url ? formatSourceSite(boat.source_site) : boat.seller_name || "Seller"}
                  </p>
                  <p className="text-xs text-text-secondary">{getSellerSubtitle(boat)}</p>
                </div>
              </div>

              <div className="my-5 h-px bg-border" />

              <p className="text-2xl font-bold">{displayedPrice.primary}</p>
              {displayedPrice.secondary && (
                <p className="mt-1 text-sm text-text-secondary">{displayedPrice.secondary}</p>
              )}

              {boat.condition_score && (
                <p className="mt-2 text-sm text-text-secondary">
                  Condition: <span className="font-semibold text-foreground">{boat.condition_score}/10</span>
                </p>
              )}

              <ContactOwnerCTA
                sourceUrl={boat.source_url}
                boatId={boat.id}
                boatTitle={`${boat.year} ${boat.make} ${boat.model}`}
                sourceName={boat.source_site ? formatSourceSite(boat.source_site) : null}
                boatSlug={boat.slug || boat.id}
                className="mt-6 block w-full rounded-full bg-accent-btn px-8 py-4 text-center text-lg font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
              />
              <p className="mt-3 text-center text-xs text-text-tertiary">Free to message sellers.</p>
            </div>
          </div>
        </div>

        {(relatedBoats.length > 0 || relatedHubLinks.length > 0) && (
          <div className="mt-12 space-y-8 border-t border-border pt-10">
            {relatedBoats.length > 0 && (
              <section>
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">
                    Keep Comparing
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">Similar boats to consider</h2>
                  <p className="mt-2 text-text-secondary">
                    These listings line up with this boat on make, location, or buyer-intent tags so you can compare the market without restarting your search.
                  </p>
                </div>
                <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {relatedBoats.map((relatedBoat) => (
                    <BoatCard
                      key={relatedBoat.id}
                      boat={relatedBoat}
                      displayCurrency={preferredCurrency}
                    />
                  ))}
                </div>
              </section>
            )}

            {relatedHubLinks.length > 0 && (
              <SeoHubLinks
                compact
                links={relatedHubLinks}
                title="Keep browsing this market"
                subtitle="Jump into the strongest make, region, and boat-type hubs connected to this listing."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const SOURCE_NAMES: Record<string, string> = {
  sailboatlistings: "Sailboat Listings",
  theyachtmarket: "The Yacht Market",
  catamarans_com: "Catamarans.com",
  catamaransite: "Catamaran Site",
  camperandnicholsons: "Camper & Nicholsons",
  denison: "Denison Yachting",
  dreamyacht: "Dream Yacht Sales",
  moorings: "The Moorings",
  multihullcompany: "Multihull Company",
  multihullworld: "Multihull World",
  apolloduck_us: "Apollo Duck",
  boote_yachten: "Boote & Yachten",
  vi_yachtbroker: "VI Yacht Broker",
};

function formatSourceSite(source: string | null): string {
  if (!source) return "External Listing";
  return SOURCE_NAMES[source] || source.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSellerSubtitle(boat: Pick<BoatDetail, "source_url" | "seller_subscription_tier">) {
  if (boat.source_url) {
    return "Original Listing";
  }

  if (boat.seller_subscription_tier === "featured" || boat.seller_subscription_tier === "broker") {
    return "Featured Seller";
  }

  return "Exclusive to OnlyHulls";
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-lg bg-surface px-3 py-2.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
