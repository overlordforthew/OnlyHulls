import type { Metadata } from "next";
import { getPublicAppUrl } from "@/lib/config/urls";

const appUrl = getPublicAppUrl();

export const metadata: Metadata = {
  title: "Browse Boats for Sale",
  description:
    "Browse catamarans and sailboats for sale on OnlyHulls. Search cleaner listings, compare boats, and connect directly with sellers.",
  alternates: {
    canonical: `${appUrl}/boats`,
  },
  openGraph: {
    type: "website",
    url: `${appUrl}/boats`,
    title: "Browse Boats for Sale | OnlyHulls",
    description:
      "Browse catamarans and sailboats for sale on OnlyHulls. Search cleaner listings, compare boats, and connect directly with sellers.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Browse boats for sale on OnlyHulls",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Browse Boats for Sale | OnlyHulls",
    description:
      "Browse catamarans and sailboats for sale on OnlyHulls. Search cleaner listings, compare boats, and connect directly with sellers.",
    images: ["/og-image.png"],
  },
};

export default function BoatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
