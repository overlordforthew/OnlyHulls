import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { ArrowLeft, Sparkles, User } from "lucide-react";
import { query, queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  buildVisibleImportQualitySql,
  hasUsableImportedLocation,
  sanitizeImportedBoatRecord,
} from "@/lib/import-quality";
import { ContactOwnerCTA } from "@/components/MatchCTA";
import BoatLeadActions from "@/components/BoatLeadActions";
import BoatCard from "@/components/BoatCard";
import CurrencySelector from "@/components/CurrencySelector";
import { getBoatDetailCopy, type BoatDetailCopy } from "@/i18n/copy/boat-detail";
import { ImageGallery } from "@/components/ImageGallery";
import JsonLdScript from "@/components/JsonLdScript";
import { getDisplayedPrice, normalizeSupportedCurrency } from "@/lib/currency";
import { getPublicAppUrl } from "@/lib/config/urls";
import SeoHubLinks from "@/components/seo/SeoHubLinks";
import { buildBoatPublicSummary } from "@/lib/browse-summary";
import { buildBoatFitReasons } from "@/lib/boat-fit";
import { getRelatedBoats } from "@/lib/db/queries";
import { sanitizeHullMaterial } from "@/lib/specs/hull-material";
import { getRelevantSeoHubLinksForBoat } from "@/lib/seo/hubs";
import { getSafeExternalUrl } from "@/lib/url-safety";
import { buildBoatDetailFacts, buildBoatDisplayTitle } from "@/lib/boats/detail-display";

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
  public_visible?: boolean;
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

function buildBoatMetaDescription(boat: BoatDetail, priceStr: string, copy: BoatDetailCopy) {
  const title = buildBoatDisplayTitle(boat);
  const location = boat.location_text ?? null;
  const summary = buildBoatPublicSummary({
    summary: boat.ai_summary,
    title,
    locationText: location,
    sourceSite: boat.source_site,
    maxLength: 240,
  });
  if (summary) {
    return trimMetaDescription(copy.metadata.summaryDescription(title, location, summary));
  }

  return trimMetaDescription(copy.metadata.defaultDescription(title, location, priceStr));
}

async function getPublicBoat(slug: string): Promise<BoatDetail | null> {
  const boat = await queryOne<BoatDetail>(
    `SELECT b.id, b.seller_id, b.make, b.model, b.year, b.asking_price, b.currency, b.status, b.asking_price_usd,
            b.location_text, b.slug, b.is_sample, b.source_url, b.source_site,
            u.display_name as seller_name,
            COALESCE(u.subscription_tier::text, 'free') as seller_subscription_tier,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.condition_score, d.ai_summary,
            (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
            (${buildVisibleImportQualitySql("b")}) as public_visible
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     LEFT JOIN users u ON u.id = b.seller_id
     WHERE (b.slug = $1 OR b.id::text = $1)
       AND b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}`,
    [slug]
  );
  return boat ? (sanitizeImportedBoatRecord(boat) as BoatDetail) : null;
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
            (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
            (${buildVisibleImportQualitySql("b")}) as public_visible
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     LEFT JOIN users u ON u.id = b.seller_id
     WHERE (b.slug = $1 OR b.id::text = $1)`,
    [slug]
  );

  if (!boat) {
    return null;
  }

  const normalizedBoat = sanitizeImportedBoatRecord(boat) as BoatDetail;

  if (normalizedBoat.status === "active") {
    return normalizedBoat.public_visible ? normalizedBoat : null;
  }

  if (viewerRole === "admin" || normalizedBoat.seller_id === viewerId) {
    return normalizedBoat;
  }

  return null;
}

async function getBoatMedia(boatId: string) {
  return query<{
    id: string;
    type: "image" | "video";
    url: string;
    thumbnailUrl: string | null;
    caption: string | null;
  }>(
    `SELECT id, type, url, thumbnail_url AS "thumbnailUrl", caption
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
  const locale = await getLocale();
  const copy = getBoatDetailCopy(locale);
  const boat = await getPublicBoat(slug);
  if (!boat) return { title: copy.metadata.boatNotFoundTitle };

  const appUrl = getPublicAppUrl();
  const canonicalUrl = `${appUrl}/boats/${slug}`;
  const boatTitle = buildBoatDisplayTitle(boat);
  const heroImage = toAbsoluteUrl(boat.hero_url, appUrl);
  const priceStr = boat.asking_price_usd
    ? `$${Math.round(boat.asking_price_usd).toLocaleString(locale)}`
    : `$${Math.round(boat.asking_price).toLocaleString(locale)} ${boat.currency}`;
  const title = boat.location_text
    ? copy.metadata.titleWithLocation(boatTitle, boat.location_text)
    : copy.metadata.titleWithoutLocation(boatTitle);
  const description = buildBoatMetaDescription(boat, priceStr, copy);
  const keywords = [
    boat.make,
    boat.model,
    String(boat.year),
    copy.metadata.keywordBoatForSale,
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
  const locale = await getLocale();
  const copy = getBoatDetailCopy(locale);
  const preferredCurrency = normalizeSupportedCurrency(
    cookieStore.get("preferred_currency")?.value
  );
  const viewer = await getCurrentUser();
  const boat = await getBoatForViewer(slug, viewer?.id ?? null, viewer?.role ?? null);
  if (!boat) notFound();
  const appUrl = getPublicAppUrl();
  const boatUrl = `${appUrl}/boats/${slug}`;
  const formatNumber = (value: number) => value.toLocaleString(locale);

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
  const hullMaterial = sanitizeHullMaterial(specs.hull_material);
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
  const boatTitle = buildBoatDisplayTitle(boat);
  const headlineFacts = buildBoatDetailFacts({
    year: boat.year,
    locationText: boat.location_text,
    specs,
    labels: {
      year: copy.specLabels.year,
      location: copy.specLabels.location,
      loa: copy.specLabels.loa,
    },
  });
  const displaySummary = buildBoatPublicSummary({
    summary: boat.ai_summary,
    title: boatTitle,
    locationText: boat.location_text,
    sourceSite: boat.source_site,
  });
  const whyThisBoatReasons = buildBoatFitReasons({
    locale,
    specs,
    characterTags: boat.character_tags,
    locationText: boat.location_text,
    sourceUrl: boat.source_url,
    similarBoatCount: relatedBoats.length,
  });
  const imageCount = media.filter((mediaItem) => mediaItem.type === "image").length;
  const videoCount = media.filter((mediaItem) => mediaItem.type === "video").length;
  const hasSpecificLocation = boat.source_url
    ? hasUsableImportedLocation(boat.location_text)
    : Boolean(boat.location_text?.trim());
  const trustSourceLabel = boat.source_url
    ? copy.trust.importedSource(
        formatSourceSite(boat.source_site, copy.trust.externalListingFallback)
      )
    : copy.trust.exclusiveOnlyHulls;
  const contactSteps = boat.source_url
    ? copy.contactSteps.imported(
        formatSourceSite(boat.source_site, copy.trust.externalListingFallback)
      )
    : copy.contactSteps.direct;
  const imageUrls = media
    .filter((mediaItem) => mediaItem.type === "image")
    .slice(0, 8)
    .map((mediaItem) => toAbsoluteUrl(mediaItem.url, appUrl))
    .filter((url): url is string => Boolean(url));
  const safeSourceUrl = getSafeExternalUrl(boat.source_url);
  const similarBrowseParams = new URLSearchParams();
  similarBrowseParams.set("q", boat.make);
  if (boat.location_text) {
    similarBrowseParams.set("location", boat.location_text);
  }
  similarBrowseParams.set("sort", "newest");
  similarBrowseParams.set("dir", "desc");
  const similarBrowseUrl = `/boats?${similarBrowseParams.toString()}`;
  const listingSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: boatTitle,
    category: copy.metadata.schemaCategory,
    model: boat.model,
    sku: boat.slug || boat.id,
    description: buildBoatMetaDescription(
      boat,
      boat.asking_price_usd
        ? `$${Math.round(boat.asking_price_usd).toLocaleString(locale)}`
        : `${boat.currency} ${Math.round(boat.asking_price).toLocaleString(locale)}`,
      copy
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
          ? formatSourceSite(boat.source_site, copy.trust.externalListingFallback)
          : boat.seller_name || copy.metadata.sellerFallback,
      },
    },
    ...(boat.location_text && {
      availableAtOrFrom: {
        "@type": "Place",
        name: boat.location_text,
      },
    }),
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: copy.specLabels.year,
        value: boat.year,
      },
    ],
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: copy.metadata.homeBreadcrumb,
        item: appUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: copy.metadata.browseBreadcrumb,
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
      <JsonLdScript data={listingSchema} />
      <JsonLdScript data={breadcrumbSchema} />

      <div className="border-b border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-5 py-3">
          <Link
            href="/boats"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.backToBrowse}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pt-6">
        <ImageGallery media={media} alt={boatTitle} />

        {boat.status !== "active" && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              boat.status === "pending_review"
                ? "border-accent/20 bg-accent/10 text-accent"
                : "border-red-500/20 bg-red-500/10 text-red-300"
            }`}
          >
            {boat.status === "pending_review"
              ? copy.previewPending
              : copy.previewInactive}
          </div>
        )}

        {boat.is_sample && (
          <div className="mt-4 rounded-lg border border-accent/20 bg-accent/10 px-4 py-2 text-sm text-accent">
            {copy.sampleListing}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div>
              <h1 className="break-words text-3xl font-bold leading-tight">{boatTitle}</h1>
              {headlineFacts.length > 0 && (
                <dl className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
                  {headlineFacts.map((fact, index) => (
                    <div
                      key={fact.key}
                      className={`flex max-w-full min-w-0 items-baseline gap-1.5 ${
                        fact.key === "location" ? "basis-full sm:basis-auto" : "shrink-0"
                      }`}
                    >
                      {index > 0 && (
                        <span aria-hidden="true" className="hidden text-text-tertiary sm:inline">
                          &middot;
                        </span>
                      )}
                      <dt className="shrink-0 font-medium text-text-tertiary">{fact.label}</dt>
                      <dd className="min-w-0 break-words font-semibold text-foreground">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
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

            {displaySummary && (
              <div className="rounded-xl border-l-4 border-primary bg-surface p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  {copy.listingDescription}
                </div>
                <p className="mt-3 whitespace-pre-wrap leading-relaxed text-foreground/80">
                  {displaySummary}
                </p>
              </div>
            )}

            {whyThisBoatReasons.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-6">
                <h2 className="text-xl font-bold">{copy.whyThisBoatHeading}</h2>
                <p className="mt-2 text-sm text-text-secondary">{copy.whyThisBoatDescription}</p>
                <div className="mt-4 space-y-3">
                  {whyThisBoatReasons.map((reason) => (
                    <div key={reason} className="flex items-start gap-3 text-sm text-foreground/80">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <p>{reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold">{copy.specifications}</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <SpecRow label={copy.specLabels.year} value={String(boat.year)} />
                {specs.loa ? <SpecRow label={copy.specLabels.loa} value={`${specs.loa}ft`} /> : null}
                {specs.beam ? <SpecRow label={copy.specLabels.beam} value={`${specs.beam}ft`} /> : null}
                {specs.draft ? <SpecRow label={copy.specLabels.draft} value={`${specs.draft}ft`} /> : null}
                {specs.vessel_type ? <SpecRow label={copy.specLabels.boatType} value={String(specs.vessel_type)} /> : null}
                {specs.rig_type ? <SpecRow label={copy.specLabels.rigType} value={String(specs.rig_type)} /> : null}
                {hullMaterial ? <SpecRow label={copy.specLabels.hull} value={hullMaterial} /> : null}
                {specs.engine ? <SpecRow label={copy.specLabels.engine} value={String(specs.engine)} /> : null}
                {specs.cabins ? <SpecRow label={copy.specLabels.cabins} value={String(specs.cabins)} /> : null}
                {specs.berths ? <SpecRow label={copy.specLabels.berths} value={String(specs.berths)} /> : null}
                {specs.heads ? <SpecRow label={copy.specLabels.heads} value={String(specs.heads)} /> : null}
                {specs.displacement ? (
                  <SpecRow
                    label={copy.specLabels.displacement}
                    value={`${formatNumber(Number(specs.displacement))} kg`}
                  />
                ) : null}
                {specs.keel_type ? <SpecRow label={copy.specLabels.keel} value={String(specs.keel_type)} /> : null}
                {specs.fuel_type ? <SpecRow label={copy.specLabels.fuel} value={String(specs.fuel_type)} /> : null}
              </div>
            </div>

            {boat.character_tags.length > 0 && (
              <div>
                <h3 className="font-semibold">{copy.character}</h3>
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
                    {boat.source_url
                      ? formatSourceSite(boat.source_site, copy.trust.externalListingFallback)
                      : boat.seller_name || copy.sellerFallback}
                  </p>
                  <p className="text-xs text-text-secondary">{getSellerSubtitle(boat, copy)}</p>
                </div>
              </div>

              <div className="my-5 h-px bg-border" />

              <p className="text-2xl font-bold">{displayedPrice.primary}</p>
              {displayedPrice.secondary && (
                <p className="mt-1 text-sm text-text-secondary">{displayedPrice.secondary}</p>
              )}

              {boat.condition_score && (
                <p className="mt-2 text-sm text-text-secondary">
                  <span className="font-semibold text-foreground">
                    {copy.conditionLabel(boat.condition_score)}
                  </span>
                </p>
              )}

              <ContactOwnerCTA
                sourceUrl={boat.source_url}
                boatId={boat.id}
                boatTitle={boatTitle}
                sourceName={
                  boat.source_url
                    ? formatSourceSite(boat.source_site, copy.trust.externalListingFallback)
                    : null
                }
                boatSlug={boat.slug || boat.id}
                className="mt-6 block w-full rounded-full bg-accent-btn px-8 py-4 text-center text-lg font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
              />
              <p className="mt-3 text-center text-xs text-text-tertiary">{copy.freeToMessage}</p>

              <div className="mt-4 rounded-xl border border-border bg-background/40 p-4">
                <p className="text-sm font-semibold text-foreground">{copy.whatHappensNext}</p>
                <div className="mt-3 space-y-2 text-sm text-text-secondary">
                  {contactSteps.map((step) => (
                    <div key={step} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="text-sm font-semibold text-foreground">{copy.listingTrust}</p>
              <div className="mt-4 space-y-3 text-sm text-text-secondary">
                <div className="flex items-start justify-between gap-4">
                  <span>{copy.trust.source}</span>
                  <span className="text-right font-medium text-foreground">{trustSourceLabel}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span>{copy.trust.photos}</span>
                  <span className="text-right font-medium text-foreground">
                    {copy.trust.images(imageCount)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span>{copy.trust.video}</span>
                  <span className="text-right font-medium text-foreground">
                    {videoCount > 0 ? copy.trust.clips(videoCount) : copy.trust.noneAttached}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span>{copy.trust.locationConfidence}</span>
                  <span className="text-right font-medium text-foreground">
                    {hasSpecificLocation
                      ? copy.trust.specificLocationProvided
                      : copy.trust.locationStillBeingVerified}
                  </span>
                </div>
              </div>
              {safeSourceUrl && (
                <a
                  href={safeSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary-light"
                >
                  {copy.trust.viewOriginalSourceListing}
                </a>
              )}
            </div>

            <BoatLeadActions
              boatId={boat.id}
              boatSlug={boat.slug || boat.id}
              boatMake={boat.make}
              locationText={boat.location_text}
              browseSimilarUrl={similarBrowseUrl}
              similarBoatCount={relatedBoats.length}
              canClaimImportedListing={Boolean(boat.source_url)}
            />
          </div>
        </div>

        {(relatedBoats.length > 0 || relatedHubLinks.length > 0) && (
          <div className="mt-12 space-y-8 border-t border-border pt-10">
            {relatedBoats.length > 0 && (
              <section id="similar-boats">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">
                    {copy.keepComparingEyebrow}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">{copy.similarBoatsHeading}</h2>
                  <p className="mt-2 text-text-secondary">
                    {copy.similarBoatsDescription}
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
                title={copy.keepBrowsingMarketTitle}
                subtitle={copy.keepBrowsingMarketSubtitle}
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

function formatSourceSite(source: string | null, fallback = "External Listing"): string {
  if (!source) return fallback;
  return SOURCE_NAMES[source] || source.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSellerSubtitle(
  boat: Pick<BoatDetail, "source_url" | "seller_subscription_tier">,
  copy: BoatDetailCopy
) {
  if (boat.source_url) {
    return copy.sellerSubtitles.originalListing;
  }

  if (boat.seller_subscription_tier === "featured" || boat.seller_subscription_tier === "broker") {
    return copy.sellerSubtitles.featuredSeller;
  }

  return copy.sellerSubtitles.exclusiveOnlyHulls;
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-surface px-3 py-2.5">
      <span className="shrink-0 whitespace-nowrap text-sm text-text-secondary">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium">{value}</span>
    </div>
  );
}
