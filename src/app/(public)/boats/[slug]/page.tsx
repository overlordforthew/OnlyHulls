import { query, queryOne } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

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
    title: `${boat.year} ${boat.make} ${boat.model} — $${boat.asking_price.toLocaleString()}`,
    description:
      boat.ai_summary ||
      `${boat.year} ${boat.make} ${boat.model} for sale at $${boat.asking_price.toLocaleString()} ${boat.currency}. ${boat.location_text || ""}`,
    openGraph: {
      title: `${boat.year} ${boat.make} ${boat.model}`,
      description: `$${boat.asking_price.toLocaleString()} ${boat.currency} — ${boat.location_text || "Location TBD"}`,
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

  const media = await getBoatMedia(boat.id);
  const specs = boat.specs as Record<string, unknown>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">⛵</span>
            <span className="text-xl font-bold text-primary">DateMyBoat</span>
          </Link>
          <Link
            href="/boats"
            className="text-sm text-foreground/70 hover:text-foreground"
          >
            Back to Browse
          </Link>
        </div>
      </header>

      {/* JSON-LD Structured Data */}
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
          }),
        }}
      />

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Hero */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {boat.year} {boat.make} {boat.model}
            </h1>
            {boat.location_text && (
              <p className="mt-1 text-foreground/60">{boat.location_text}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">
              ${boat.asking_price.toLocaleString()}
            </p>
            <p className="text-sm text-foreground/60">{boat.currency}</p>
          </div>
        </div>

        {boat.is_sample && (
          <div className="mt-4 rounded-lg bg-accent/10 px-4 py-2 text-sm text-accent">
            This is a sample listing for demonstration purposes.
          </div>
        )}

        {/* Photos */}
        {media.length > 0 ? (
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {media.map((m) => (
              <img
                key={m.id}
                src={m.url}
                alt={m.caption || `${boat.make} ${boat.model}`}
                className="rounded-lg object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 flex aspect-video items-center justify-center rounded-lg bg-muted text-6xl text-foreground/20">
            ⛵
          </div>
        )}

        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {/* Specs */}
          <div className="md:col-span-2">
            {boat.ai_summary && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold">About This Boat</h2>
                <p className="mt-3 whitespace-pre-wrap text-foreground/70">
                  {boat.ai_summary}
                </p>
              </div>
            )}

            <h2 className="text-xl font-semibold">Specifications</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              {specs.loa ? <Spec label="LOA" value={`${specs.loa}ft`} /> : null}
              {specs.beam ? <Spec label="Beam" value={`${specs.beam}ft`} /> : null}
              {specs.draft ? <Spec label="Draft" value={`${specs.draft}ft`} /> : null}
              {specs.rig_type ? <Spec label="Rig Type" value={String(specs.rig_type)} /> : null}
              {specs.hull_material ? <Spec label="Hull" value={String(specs.hull_material)} /> : null}
              {specs.engine ? <Spec label="Engine" value={String(specs.engine)} /> : null}
              {specs.berths ? <Spec label="Berths" value={String(specs.berths)} /> : null}
              {specs.heads ? <Spec label="Heads" value={String(specs.heads)} /> : null}
            </div>

            {boat.character_tags.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium">Character</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {boat.character_tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-3 py-1 text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div className="rounded-xl border border-border p-6">
              <p className="text-2xl font-bold text-primary">
                ${boat.asking_price.toLocaleString()}
              </p>
              <p className="text-sm text-foreground/60">{boat.currency}</p>
              {boat.condition_score && (
                <p className="mt-3 text-sm">
                  Condition: {boat.condition_score}/10
                </p>
              )}
              <Link
                href="/sign-up?role=buyer"
                className="mt-6 block rounded-full bg-primary py-3 text-center text-sm font-medium text-white hover:bg-primary-dark"
              >
                Sign Up to Connect
              </Link>
              <p className="mt-3 text-center text-xs text-foreground/40">
                Free to browse. Connect with Plus or Pro plan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2">
      <span className="text-foreground/60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
