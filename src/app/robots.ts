import { getPublicAppUrl } from "@/lib/config/urls";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getPublicAppUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/boats", "/match", "/sell"],
        disallow: ["/admin", "/api/", "/onboarding", "/matches", "/listings"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
