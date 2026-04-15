import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { getPublicAppUrl } from "@/lib/config/urls";
import { getCompareLayoutCopy } from "@/i18n/copy/layouts";

const appUrl = getPublicAppUrl();

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getCompareLayoutCopy(locale);

  return {
    title: copy.title,
    metadataBase: new URL(appUrl),
    description: copy.description,
    alternates: {
      canonical: `${appUrl}/compare`,
    },
    openGraph: {
      title: `${copy.title} | OnlyHulls`,
      description: copy.ogDescription,
      url: `${appUrl}/compare`,
    },
    twitter: {
      title: `${copy.title} | OnlyHulls`,
      description: copy.twitterDescription,
    },
  };
}

export default function CompareLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
