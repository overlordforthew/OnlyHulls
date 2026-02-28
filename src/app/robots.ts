import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://onlyhulls.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/boats", "/pricing"],
        disallow: ["/admin", "/api/", "/onboarding", "/matches", "/listings"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
