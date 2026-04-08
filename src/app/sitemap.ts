import { query } from "@/lib/db";
import { getPublicAppUrl } from "@/lib/config/urls";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getPublicAppUrl();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: appUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${appUrl}/boats`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${appUrl}/match`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${appUrl}/sell`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${appUrl}/sign-in`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${appUrl}/sign-up`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Category pages
  const tags = ["bluewater", "liveaboard-ready", "race-ready", "family-friendly", "budget-friendly", "classic"];
  const tagPages: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${appUrl}/boats?tag=${tag}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // ALL boat listing pages — no limit
  try {
    const boats = await query<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at
       FROM boats b
       WHERE b.status = 'active'
         AND b.slug IS NOT NULL
         AND ${buildVisibleImportQualitySql("b")}
       ORDER BY b.updated_at DESC`
    );

    const boatPages: MetadataRoute.Sitemap = boats.map((boat) => ({
      url: `${appUrl}/boats/${boat.slug}`,
      lastModified: new Date(boat.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticPages, ...tagPages, ...boatPages];
  } catch {
    return [...staticPages, ...tagPages];
  }
}
