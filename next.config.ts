import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.your-objectstorage.com",
      },
      {
        protocol: "https",
        hostname: "*.sailboatlistings.com",
      },
      {
        protocol: "https",
        hostname: "images.boatsgroup.com",
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
