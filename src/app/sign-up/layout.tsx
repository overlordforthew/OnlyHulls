import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { getPublicAppUrl } from "@/lib/config/urls";
import { getAuthLayoutCopy } from "@/i18n/copy/layouts";

const appUrl = getPublicAppUrl();

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getAuthLayoutCopy(locale);

  return {
    title: copy.signUpTitle,
    alternates: {
      canonical: `${appUrl}/sign-up`,
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
