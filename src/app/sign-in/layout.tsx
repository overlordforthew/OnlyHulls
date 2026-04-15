import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { getPublicAppUrl } from "@/lib/config/urls";
import { getAuthLayoutCopy } from "@/i18n/copy/layouts";

const appUrl = getPublicAppUrl();

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getAuthLayoutCopy(locale);

  return {
    title: copy.signInTitle,
    alternates: {
      canonical: `${appUrl}/sign-in`,
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
