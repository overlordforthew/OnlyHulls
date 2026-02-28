import { query } from "@/lib/db";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://datemyboat.namibarden.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: appUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${appUrl}/boats`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${appUrl}/pricing`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  ];

  // Dynamic boat listing pages
  try {
    const boats = await query<{ slug: string; updated_at: string }>(
      "SELECT slug, updated_at FROM boats WHERE status = 'active' AND slug IS NOT NULL ORDER BY updated_at DESC LIMIT 1000"
    );

    const boatPages: MetadataRoute.Sitemap = boats.map((boat) => ({
      url: `${appUrl}/boats/${boat.slug}`,
      lastModified: new Date(boat.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    return [...staticPages, ...boatPages];
  } catch {
    return staticPages;
  }
}
