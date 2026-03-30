import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://*.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://*.your-objectstorage.com https://www.sailboatlistings.com https://ics.apolloduck.com https://cdnx.theyachtmarket.com",
              "connect-src 'self' https://*.posthog.com",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.your-objectstorage.com",
      },
      {
        protocol: "https",
        hostname: "www.sailboatlistings.com",
      },
      {
        protocol: "https",
        hostname: "ics.apolloduck.com",
      },
      {
        protocol: "https",
        hostname: "cdnx.theyachtmarket.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
