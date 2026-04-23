import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/config/urls";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getPublicAppUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/boats", "/match", "/sell", "/about", "/privacy", "/terms"],
        disallow: [
          "/admin",
          "/api/",
          "/account",
          "/forgot-password",
          "/listings",
          "/matches",
          "/onboarding",
          "/reset-password",
          "/saved-searches",
          "/sign-in",
          "/sign-up",
          // Browse/map URL-state variants create unbounded crawlable permutations
          // every time a user pans the map or tweaks a filter. Canonicals point
          // these back to the base hub, but keeping crawlers out saves budget.
          "/*?*mapCenter=*",
          "/*?*mapZoom=*",
          "/*?*view=map*",
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
