import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "OnlyHulls — The OnlyFans of Boats",
    template: "%s | OnlyHulls",
  },
  description:
    "The boat marketplace that doesn't suck. AI-powered matching, zero commission, and a community of boat lovers. Find your perfect hull.",
  openGraph: {
    type: "website",
    siteName: "OnlyHulls",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <SiteNav />
          <main className="min-h-screen">{children}</main>
          <SiteFooter />
          <ThemeSwitcher />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
