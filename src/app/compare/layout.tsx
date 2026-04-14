import type { Metadata } from "next";
import { getPublicAppUrl } from "@/lib/config/urls";

const appUrl = getPublicAppUrl();

export const metadata: Metadata = {
  title: "Compare Boats",
  metadataBase: new URL(appUrl),
  description:
    "Compare boat listings side by side on OnlyHulls. Review price, draft, layout, trust signals, and share your shortlist with one link.",
  alternates: {
    canonical: `${appUrl}/compare`,
  },
  openGraph: {
    title: "Compare Boats | OnlyHulls",
    description:
      "Review boat shortlists side by side, compare the factors that matter, and share the same compare set with one link.",
    url: `${appUrl}/compare`,
  },
  twitter: {
    title: "Compare Boats | OnlyHulls",
    description:
      "Compare boat shortlists side by side on OnlyHulls and share the same compare set with one link.",
  },
};

export default function CompareLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
