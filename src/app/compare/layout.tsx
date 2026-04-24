import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { getPublicAppUrl } from "@/lib/config/urls";
import { getCompareLayoutCopy } from "@/i18n/copy/layouts";

const appUrl = getPublicAppUrl();

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getCompareLayoutCopy(locale);

  const canonical =
    locale === "en" ? `${appUrl}/compare` : `${appUrl}/${locale}/compare`;

  return {
    title: copy.title,
    metadataBase: new URL(appUrl),
    description: copy.description,
    alternates: {
      canonical,
      languages: {
        en: `${appUrl}/compare`,
        es: `${appUrl}/es/compare`,
        "x-default": `${appUrl}/compare`,
      },
    },
    openGraph: {
      title: `${copy.title} | OnlyHulls`,
      description: copy.ogDescription,
      url: canonical,
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
