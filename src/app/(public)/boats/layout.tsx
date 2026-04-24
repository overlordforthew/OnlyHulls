import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { getPublicAppUrl } from "@/lib/config/urls";
import { getBoatsLayoutCopy } from "@/i18n/copy/layouts";

const appUrl = getPublicAppUrl();

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getBoatsLayoutCopy(locale);

  const canonical = locale === "en" ? `${appUrl}/boats` : `${appUrl}/es/boats`;
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical,
      languages: {
        en: `${appUrl}/boats`,
        es: `${appUrl}/es/boats`,
        "x-default": `${appUrl}/boats`,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      title: copy.ogTitle,
      description: copy.ogDescription,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: copy.ogAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.ogTitle,
      description: copy.twitterDescription,
      images: ["/og-image.png"],
    },
  };
}

export default function BoatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
