import { query, queryOne } from "@/lib/db";
import Link from "next/link";
import { ContactOwnerCTA } from "@/components/MatchCTA";
import { ImageGallery } from "@/components/ImageGallery";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Sparkles, User, ArrowLeft } from "lucide-react";

interface BoatDetail {
  id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  location_text: string | null;
  slug: string | null;
  is_sample: boolean;
  seller_name: string | null;
  specs: Record<string, unknown>;
  character_tags: string[];
  condition_score: number | null;
  ai_summary: string | null;
}

async function getBoat(slug: string): Promise<BoatDetail | null> {
  return queryOne<BoatDetail>(
    `SELECT b.id, b.make, b.model, b.year, b.asking_price, b.currency,
            b.location_text, b.slug, b.is_sample,
            u.display_name as seller_name,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.condition_score, d.ai_summary
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     LEFT JOIN users u ON u.id = b.seller_id
     WHERE (b.slug = $1 OR b.id::text = $1)
       AND b.status = 'active'`,
    [slug]
  );
}

async function getBoatMedia(boatId: string) {
  return query<{ id: string; url: string; caption: string | null }>(
    `SELECT id, url, caption FROM boat_media WHERE boat_id = $1 ORDER BY sort_order`,
    [boatId]
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const boat = await getBoat(slug);
  if (!boat) return { title: "Boat Not Found" };
  return {
    title: `${boat.year} ${boat.make} ${boat.model} — $${Math.round(boat.asking_price).toLocaleString("en-US")}`,
    description:
      boat.ai_summary ||
      `${boat.year} ${boat.make} ${boat.model} for sale at $${Math.round(boat.asking_price).toLocaleString("en-US")} ${boat.currency}. ${boat.location_text || ""}`,
    openGraph: {
      title: `${boat.year} ${boat.make} ${boat.model}`,
      description: `$${Math.round(boat.asking_price).toLocaleString("en-US")} ${boat.currency} — ${boat.location_text || "Location TBD"}`,
    },
  };
}

export default async function BoatDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const boat = await getBoat(slug);
  if (!boat) notFound();

  // Increment view count (fire-and-forget, don't block render)
  query(
    `UPDATE boats SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = $1`,
    [boat.id]
  ).catch(() => {});

  const media = await getBoatMedia(boat.id);
  const specs = boat.specs as Record<string, unknown>;
  const sellerInitial = boat.seller_name?.[0]?.toUpperCase() || "S";

  return (
    <div className="pb-16">
      {/* JSON-LD Structured Data — replace </ to prevent script breakout */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: `${boat.year} ${boat.make} ${boat.model}`,
            description: boat.ai_summary || `${boat.year} ${boat.make} ${boat.model} for sale`,
            offers: {
              "@type": "Offer",
              price: boat.asking_price,
              priceCurrency: boat.currency,
              availability: "https://schema.org/InStock",
            },
            ...(boat.location_text && {
              availableAtOrFrom: {
                "@type": "Place",
                name: boat.location_text,
              },
            }),
          }).replace(/</g, "\\u003c"),
        }}
      />

      {/* Back link */}
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
        {/* Gallery */}
        <ImageGallery media={media} alt={`${boat.make} ${boat.model}`} />

        {boat.is_sample && (
          <div className="mt-4 rounded-lg bg-accent/10 border border-accent/20 px-4 py-2 text-sm text-accent">
            This is a sample listing for demonstration purposes.
          </div>
        )}

        {/* Content grid */}
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title + Price */}
            <div>
              <h1 className="text-3xl font-bold">
                {`${boat.year} ${boat.make} ${boat.model}`}
              </h1>
              {boat.location_text && (
                <p className="mt-2 flex items-center gap-1.5 text-text-secondary">
                  <MapPin className="h-4 w-4" />
                  {boat.location_text}
                </p>
              )}
              <p className="mt-3 text-3xl font-bold">
                ${Math.round(boat.asking_price).toLocaleString("en-US")}
                <span className="ml-2 text-sm font-normal text-text-secondary">{boat.currency}</span>
              </p>
            </div>

            {/* AI Summary */}
            {boat.ai_summary && (
              <div className="rounded-xl border-l-4 border-primary bg-surface p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  AI Analysis
                </div>
                <p className="mt-3 whitespace-pre-wrap text-foreground/80 leading-relaxed">
                  {boat.ai_summary}
                </p>
              </div>
            )}

            {/* Specifications */}
            <div>
              <h2 className="text-xl font-bold">Specifications</h2>
              <div className="mt-4 grid grid-cols-2 gap-1">
                {specs.loa ? <SpecRow label="LOA" value={`${specs.loa}ft`} /> : null}
                {specs.beam ? <SpecRow label="Beam" value={`${specs.beam}ft`} /> : null}
                {specs.draft ? <SpecRow label="Draft" value={`${specs.draft}ft`} /> : null}
                {specs.rig_type ? <SpecRow label="Rig Type" value={String(specs.rig_type)} /> : null}
                {specs.hull_material ? <SpecRow label="Hull" value={String(specs.hull_material)} /> : null}
                {specs.engine ? <SpecRow label="Engine" value={String(specs.engine)} /> : null}
                {specs.berths ? <SpecRow label="Berths" value={String(specs.berths)} /> : null}
                {specs.heads ? <SpecRow label="Heads" value={String(specs.heads)} /> : null}
              </div>
            </div>

            {/* Character Tags */}
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Seller Card (OnlyFans creator-style) */}
            <div className="rounded-xl border border-border bg-surface p-6">
              {/* Seller avatar + info */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {boat.seller_name ? sellerInitial : <User className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold">{boat.seller_name || "Seller"}</p>
                  <p className="text-xs text-text-secondary">Boat Owner</p>
                </div>
              </div>

              <div className="my-5 h-px bg-border" />

              <p className="text-2xl font-bold">
                ${Math.round(boat.asking_price).toLocaleString("en-US")}
                <span className="ml-1 text-sm font-normal text-text-secondary">{boat.currency}</span>
              </p>

              {boat.condition_score && (
                <p className="mt-2 text-sm text-text-secondary">
                  Condition: <span className="font-semibold text-foreground">{boat.condition_score}/10</span>
                </p>
              )}

              <ContactOwnerCTA
                className="mt-6 block w-full rounded-full bg-accent-btn px-6 py-3.5 text-center text-base font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
              />
              <p className="mt-3 text-center text-xs text-text-tertiary">
                Free to message sellers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-lg bg-surface px-3 py-2.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
