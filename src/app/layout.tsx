import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { getPublicAppUrl } from "@/lib/config/urls";
import { getCspNonce } from "@/lib/security/csp";
import JsonLdScript from "@/components/JsonLdScript";
import Providers from "@/components/Providers";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import WhatsAppContactButton from "@/components/WhatsAppContactButton";
import { getRootLayoutCopy } from "@/i18n/copy/layouts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = getPublicAppUrl();

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getRootLayoutCopy(locale);

  return {
    title: {
      default: copy.defaultTitle,
      template: "%s | OnlyHulls",
    },
    description: copy.description,
    metadataBase: new URL(appUrl),
    applicationName: "OnlyHulls",
    category: "marketplace",
    creator: "OnlyHulls",
    publisher: "OnlyHulls",
    keywords: [
      "boats for sale",
      "catamarans for sale",
      "sailboats for sale",
      "AI boat marketplace",
      "boat matching",
      "boat listings",
    ],
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: "website",
      siteName: "OnlyHulls",
      url: appUrl,
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
    alternates: {
      canonical: appUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = await getCspNonce();
  const locale = await getLocale();
  const copy = getRootLayoutCopy(locale);
  const messages = await getMessages();
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "OnlyHulls",
    url: appUrl,
    logo: `${appUrl}/og-image.png`,
    description: copy.organizationDescription,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@onlyhulls.com",
      },
    ],
    sameAs: [],
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "OnlyHulls",
    url: appUrl,
    description: copy.websiteDescription,
    potentialAction: {
      "@type": "SearchAction",
      target: `${appUrl}/boats?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang={locale} className="dark">
      <head>
        <JsonLdScript data={organizationSchema} />
        <JsonLdScript data={websiteSchema} />
        {process.env.NEXT_PUBLIC_POSTHOG_KEY && (
          <script
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageviewId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init(${JSON.stringify(process.env.NEXT_PUBLIC_POSTHOG_KEY)},{api_host:'https://us.i.posthog.com',person_profiles:'identified_only'})`,
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
            <WhatsAppContactButton />
            <ThemeSwitcher />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
