import type { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { getPublicAppUrl } from "@/lib/config/urls";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getPublicAppUrl();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: appUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${appUrl}/boats`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${appUrl}/match`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${appUrl}/sell`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${appUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${appUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${appUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

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

    return [...staticPages, ...boatPages];
  } catch {
    return staticPages;
  }
}
