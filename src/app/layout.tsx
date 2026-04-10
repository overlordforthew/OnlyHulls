import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import Providers from "@/components/Providers";
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
    default: "OnlyHulls - AI-Powered Boat Marketplace",
    template: "%s | OnlyHulls",
  },
  description:
    "AI-powered boat marketplace for catamarans, sailboats, and serious buyers. Better matching, cleaner listings, and direct seller connections.",
  metadataBase: new URL("https://onlyhulls.com"),
  openGraph: {
    type: "website",
    siteName: "OnlyHulls",
    url: "https://onlyhulls.com",
    title: "OnlyHulls - AI-Powered Boat Marketplace",
    description:
      "Discover catamarans and sailboats with AI-powered matching, cleaner inventory, and direct seller connections.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OnlyHulls - AI-Powered Boat Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OnlyHulls - AI-Powered Boat Marketplace",
    description:
      "AI-powered boat matching, cleaner listings, and direct seller connections.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://onlyhulls.com",
  },
  robots: {
    index: true,
    follow: true,
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "OnlyHulls",
              url: "https://onlyhulls.com",
              logo: "https://onlyhulls.com/og-image.png",
              description:
                "AI-powered boat marketplace for catamarans, sailboats, and serious buyers.",
              sameAs: [],
            }),
          }}
        />
        {process.env.NEXT_PUBLIC_POSTHOG_KEY && (
          <script
            dangerouslySetInnerHTML={{
              __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageviewId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${process.env.NEXT_PUBLIC_POSTHOG_KEY}',{api_host:'https://us.i.posthog.com',person_profiles:'identified_only'})`,
            }}
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Providers>
          <NextIntlClientProvider messages={messages}>
            <SiteNav />
            <main className="min-h-screen">{children}</main>
            <SiteFooter />
            <ThemeSwitcher />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
