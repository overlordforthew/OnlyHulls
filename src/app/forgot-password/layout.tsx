import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { getPublicAppUrl } from "@/lib/config/urls";
import { getAuthLayoutCopy } from "@/i18n/copy/layouts";

const appUrl = getPublicAppUrl();

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getAuthLayoutCopy(locale);

  return {
    title: copy.forgotPasswordTitle,
    alternates: {
      canonical: `${appUrl}/forgot-password`,
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
