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
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
