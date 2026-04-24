import type { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { getPublicAppUrl } from "@/lib/config/urls";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import { CATEGORY_HUBS, LOCATION_HUBS, MAKE_HUBS, type SeoHubDefinition } from "@/lib/seo/hubs";

// The sitemap needs DB access to compute hub lastmods and emit boat URLs;
// Coolify's build container can't reach Postgres, so Next.js SSG of this
// route at build time silently produces an empty sitemap and caches it.
// Staying dynamic keeps generation at request time where the DB is live.
// Crawlers hit this URL infrequently, so per-request cost is fine.
export const dynamic = "force-dynamic";

// Build timestamp is frozen at module load, so static pages don't churn a
// fresh lastmod on every request. Crawlers use lastmod stability as a
// freshness signal; rotating it every request trains them to ignore it.
const BUILD_TIMESTAMP = new Date();

type HubLastModRow = { href: string; last_updated: string | null; boat_count: number };

async function fetchHubLastMods(hubs: SeoHubDefinition[]): Promise<Map<string, HubLastModRow>> {
  const lastMods = new Map<string, HubLastModRow>();
  for (const hub of hubs) {
    try {
      const result = await query<{ last_updated: string | null; boat_count: string }>(
        `SELECT MAX(b.updated_at) AS last_updated, COUNT(*)::text AS boat_count
           FROM boats b
           LEFT JOIN boat_dna d ON d.boat_id = b.id
          WHERE b.status = 'active'
            AND ${buildVisibleImportQualitySql("b")}
            AND (${hub.queryWhere})`,
        hub.queryParams || []
      );
      const row = result[0];
      lastMods.set(hub.href, {
        href: hub.href,
        last_updated: row?.last_updated ?? null,
        boat_count: Number(row?.boat_count ?? 0),
      });
    } catch {
      lastMods.set(hub.href, { href: hub.href, last_updated: null, boat_count: 0 });
    }
  }
  return lastMods;
}

function hubPriority(boatCount: number) {
  if (boatCount >= 100) return 0.9;
  if (boatCount >= 20) return 0.75;
  return 0.6;
}

// Every entry gets an `alternates.languages` map so Google understands the
// en/es pairing. The helper expands a single path into a sitemap entry plus
// explicit hreflang alternates.
function withLanguages(
  appUrl: string,
  path: string,
  entry: { lastModified: Date; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }
): MetadataRoute.Sitemap[number] {
  const pathForEs = path === "" ? "/es" : `/es${path}`;
  return {
    url: `${appUrl}${path || "/"}`.replace(/\/$/, "") || appUrl,
    lastModified: entry.lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    alternates: {
      languages: {
        en: `${appUrl}${path || "/"}`.replace(/\/$/, "") || appUrl,
        es: `${appUrl}${pathForEs}`,
        "x-default": `${appUrl}${path || "/"}`.replace(/\/$/, "") || appUrl,
      },
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getPublicAppUrl();

  const staticPages: MetadataRoute.Sitemap = [
    withLanguages(appUrl, "", { lastModified: BUILD_TIMESTAMP, changeFrequency: "daily", priority: 1 }),
    withLanguages(appUrl, "/boats", { lastModified: BUILD_TIMESTAMP, changeFrequency: "daily", priority: 0.9 }),
    withLanguages(appUrl, "/match", { lastModified: BUILD_TIMESTAMP, changeFrequency: "weekly", priority: 0.8 }),
    withLanguages(appUrl, "/sell", { lastModified: BUILD_TIMESTAMP, changeFrequency: "weekly", priority: 0.7 }),
    withLanguages(appUrl, "/about", { lastModified: BUILD_TIMESTAMP, changeFrequency: "monthly", priority: 0.5 }),
    withLanguages(appUrl, "/privacy", { lastModified: BUILD_TIMESTAMP, changeFrequency: "yearly", priority: 0.2 }),
    withLanguages(appUrl, "/terms", { lastModified: BUILD_TIMESTAMP, changeFrequency: "yearly", priority: 0.2 }),
  ];

  const allHubs = [
    ...Object.values(CATEGORY_HUBS),
    ...Object.values(MAKE_HUBS),
    ...Object.values(LOCATION_HUBS),
  ];
  const lastMods = await fetchHubLastMods(allHubs);
  const hubPages: MetadataRoute.Sitemap = allHubs
    // Thin-content guard — don't publish hubs with fewer than 3 live boats.
    // They still stay reachable via internal links; they just don't get
    // broadcast to crawlers until inventory catches up.
    .filter((hub) => {
      const row = lastMods.get(hub.href);
      return (row?.boat_count ?? 0) >= 3;
    })
    .map((hub) => {
      const row = lastMods.get(hub.href);
      return withLanguages(appUrl, hub.href, {
        lastModified: row?.last_updated ? new Date(row.last_updated) : BUILD_TIMESTAMP,
        changeFrequency: "daily",
        priority: hubPriority(row?.boat_count ?? 0),
      });
    });

  try {
    const boats = await query<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at
       FROM boats b
       WHERE b.status = 'active'
         AND b.slug IS NOT NULL
         AND ${buildVisibleImportQualitySql("b")}
       ORDER BY b.updated_at DESC`
    );

    const boatPages: MetadataRoute.Sitemap = boats.map((boat) =>
      withLanguages(appUrl, `/boats/${boat.slug}`, {
        lastModified: new Date(boat.updated_at),
        changeFrequency: "weekly",
        priority: 0.6,
      })
    );

    return [...staticPages, ...hubPages, ...boatPages];
  } catch {
    return [...staticPages, ...hubPages];
  }
}
