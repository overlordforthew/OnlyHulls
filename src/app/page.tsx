import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Sailboat,
  Home as HomeIcon,
  Flag,
  Users,
  DollarSign,
  Landmark,
  Eye,
  Heart,
  Handshake,
  Zap,
  Globe,
  MapPin,
  Compass,
  Shield,
  Search,
  ArrowRight,
  Flame,
  Clock3,
} from "lucide-react";
import BoatCard from "@/components/BoatCard";
import { ListBoatCTA } from "@/components/MatchCTA";
import SeoHubLinks from "@/components/seo/SeoHubLinks";
import { getBoatCount, getFeaturedBoats } from "@/lib/db/queries";
import { getFeaturedLocationMarkets } from "@/lib/locations/top-markets";

export const dynamic = "force-dynamic";

const CATEGORY_CONFIG = [
  { key: "cruising", Icon: Sailboat, tag: "bluewater" },
  { key: "liveaboard", Icon: HomeIcon, tag: "liveaboard-ready" },
  { key: "racing", Icon: Flag, tag: "race-ready" },
  { key: "family", Icon: Users, tag: "family-friendly" },
  { key: "budget", Icon: DollarSign, tag: "budget-friendly" },
  { key: "classic", Icon: Landmark, tag: "classic" },
];

const STEP_CONFIG = [
  {
    key: "browse",
    Icon: Eye,
  },
  {
    key: "love",
    Icon: Heart,
  },
  {
    key: "connect",
    Icon: Handshake,
  },
];

const VALUE_CONFIG = [
  {
    key: "commission",
    Icon: DollarSign,
    stat: "$0",
  },
  {
    key: "matching",
    Icon: Zap,
    stat: "AI",
  },
  {
    key: "brokers",
    Icon: Shield,
    stat: "No",
  },
  {
    key: "reach",
    Icon: Globe,
    stat: "Global",
  },
];

export default async function Home() {
  const t = await getTranslations("home");
  const [count, boats] = await Promise.all([
    getBoatCount(),
    getFeaturedBoats(6),
  ]);
  const categories = CATEGORY_CONFIG.map((category) => ({
    ...category,
    label: t(`categories.${category.key}`),
  }));
  const steps = STEP_CONFIG.map((step) => ({
    ...step,
    title: t(`steps.${step.key}.title`),
    desc: t(`steps.${step.key}.description`),
  }));
  const values = VALUE_CONFIG.map((value) => ({
    ...value,
    title: t(`values.${value.key}.title`),
    desc: t(`values.${value.key}.description`),
  }));
  const heroProof = [
    t("heroProof.one"),
    t("heroProof.two"),
    t("heroProof.three"),
  ];
  const featuredLocations = getFeaturedLocationMarkets().slice(0, 4);
  const paths = [
    {
      eyebrow: t("paths.buyers.eyebrow"),
      title: t("paths.buyers.title"),
      description: t("paths.buyers.description"),
      bullets: [t("paths.buyers.bullet1"), t("paths.buyers.bullet2")],
      primaryHref: "/match",
      primaryLabel: t("paths.buyers.primary"),
      secondaryHref: "/boats",
      secondaryLabel: t("paths.buyers.secondary"),
    },
    {
      eyebrow: t("paths.sellers.eyebrow"),
      title: t("paths.sellers.title"),
      description: t("paths.sellers.description"),
      bullets: [t("paths.sellers.bullet1"), t("paths.sellers.bullet2")],
      primaryHref: null,
      primaryLabel: t("paths.sellers.primary"),
      secondaryHref: "/sell",
      secondaryLabel: t("paths.sellers.secondary"),
    },
  ];

  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden pb-12 pt-10 sm:pb-20 sm:pt-16">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-5">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              {t("heroTitleStart")}{" "}
              <span className="text-primary">{t("heroTitleAccent")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-text-secondary sm:text-xl">
              {t("heroSubtitle")}
            </p>

            {/* Search bar */}
            <form
              action="/boats"
              className="mx-auto mt-8 grid max-w-3xl gap-2 rounded-2xl border border-border-bright bg-surface p-2 text-left shadow-lg shadow-black/20 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)_auto] sm:rounded-full"
            >
              <label className="flex min-w-0 items-center gap-3 rounded-xl px-4 py-2.5 transition-colors focus-within:bg-surface-elevated sm:rounded-full">
                <Search className="h-5 w-5 shrink-0 text-text-tertiary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase text-text-tertiary">
                    {t("whatLabel")}
                  </span>
                  <input
                    type="text"
                    name="q"
                    placeholder={t("searchPlaceholder")}
                    className="mt-0.5 w-full bg-transparent text-sm text-foreground placeholder:text-text-tertiary focus:outline-none"
                  />
                </span>
              </label>
              <label className="flex min-w-0 items-center gap-3 rounded-xl border-t border-border px-4 py-2.5 transition-colors focus-within:bg-surface-elevated sm:rounded-full sm:border-l sm:border-t-0">
                <MapPin className="h-5 w-5 shrink-0 text-text-tertiary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase text-text-tertiary">
                    {t("whereLabel")}
                  </span>
                  <input
                    type="text"
                    name="location"
                    list="home-location-markets"
                    placeholder={t("locationPlaceholder")}
                    className="mt-0.5 w-full bg-transparent text-sm text-foreground placeholder:text-text-tertiary focus:outline-none"
                  />
                </span>
              </label>
              <datalist id="home-location-markets">
                {featuredLocations.map((market) => (
                  <option key={market.slug} value={market.label} />
                ))}
              </datalist>
              <button
                type="submit"
                className="rounded-xl bg-accent-btn px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light sm:rounded-full"
              >
                {t("searchButton")}
              </button>
            </form>

            <div className="mx-auto mt-3 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-sm">
              <span className="text-xs font-medium text-text-tertiary">{t("popularMarkets")}</span>
              {featuredLocations.map((market) => (
                <Link
                  key={market.slug}
                  href={market.hubHref || `/boats?location=${market.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-primary/40 hover:text-primary"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {market.label}
                </Link>
              ))}
            </div>

            {/* CTA buttons — Map first as a visually distinctive entry point. */}
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/boats?view=map"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary via-primary-btn to-accent px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-accent/30"
              >
                <Compass className="h-4 w-4 transition-transform duration-500 group-hover:rotate-[360deg]" aria-hidden="true" />
                {t("exploreOnMap")}
              </Link>
              <Link
                href="/boats"
                className="rounded-full bg-primary-btn px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-light hover:shadow-lg hover:shadow-primary/20"
              >
                {t("browseAllBoats")}
              </Link>
              <Link
                href="/match"
                className="rounded-full border border-border-bright px-8 py-3 text-sm font-semibold text-foreground transition-all hover:border-primary hover:text-primary"
              >
                {t("getMatchedByAI")}
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-text-secondary">
              {heroProof.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border bg-surface/70 px-3 py-1.5"
                >
                  {item}
                </span>
              ))}
            </div>

            {/* Stats strip */}
            <div className="mx-auto mt-8 grid max-w-2xl grid-cols-3 gap-4 rounded-2xl border border-border bg-surface/55 p-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary sm:text-3xl">{count}</p>
                <p className="mt-1 text-xs text-text-secondary">{t("stats.boatsListed")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary sm:text-3xl">$0</p>
                <p className="mt-1 text-xs text-text-secondary">{t("stats.commission")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary sm:text-3xl">AI</p>
                <p className="mt-1 text-xs text-text-secondary">{t("stats.matching")}</p>
              </div>
            </div>

            <div className="mx-auto mt-8 grid max-w-4xl gap-4 text-left lg:grid-cols-2">
              {paths.map((path) => (
                <div
                  key={path.title}
                  className="flex h-full flex-col rounded-2xl border border-border bg-surface/80 p-6 shadow-lg shadow-black/10"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                    {path.eyebrow}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">{path.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-text-secondary">{path.description}</p>
                  <div className="mt-4 space-y-2 text-sm text-text-secondary">
                    {path.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-col items-start gap-3">
                    {path.primaryHref ? (
                      <Link
                        href={path.primaryHref}
                        className="rounded-full bg-primary-btn px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-light"
                      >
                        {path.primaryLabel}
                      </Link>
                    ) : (
                      <ListBoatCTA className="rounded-full bg-primary-btn px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-light">
                        {path.primaryLabel}
                      </ListBoatCTA>
                    )}
                    <Link
                      href={path.secondaryHref}
                      className="text-sm font-medium text-text-secondary transition-all hover:text-primary"
                    >
                      {path.secondaryLabel}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Categories ─── */}
      <section className="border-y border-border bg-surface/50">
        <div className="mx-auto flex max-w-7xl justify-center gap-6 overflow-x-auto px-5 py-5 no-scrollbar sm:gap-10">
          {categories.map((cat) => (
            <Link
              key={cat.tag}
              href={`/boats?tag=${cat.tag}`}
              className="flex flex-col items-center gap-2 rounded-xl px-4 py-3 text-text-secondary transition-all hover:bg-muted hover:text-primary"
            >
              <cat.Icon className="h-7 w-7" strokeWidth={1.5} />
              <span className="whitespace-nowrap text-xs font-medium">{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <SeoHubLinks />

      {/* ─── Trending Hulls ─── */}
      {boats.length > 0 && (
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <Flame className="h-6 w-6 text-accent" />
                {t("trendingHulls")}
              </h2>
              <Link
                href="/boats"
                className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-light"
              >
                {t("viewAll")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {boats.slice(0, 6).map((boat) => (
                <BoatCard key={boat.id} boat={boat} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── How It Works ─── */}
      <section className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            {t("howTitleStart")} <span className="text-primary">{t("howTitleAccent")}</span>{t("howTitleEnd") ? ` ${t("howTitleEnd")}` : ""}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-text-secondary">
            {t("howSubtitle")}
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="group rounded-2xl border border-border bg-surface p-8 text-center transition-all hover:border-primary/30"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-all group-hover:bg-primary/20 group-hover:shadow-lg group-hover:shadow-primary/10">
                  <step.Icon className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <p className="mt-2 text-xs font-semibold text-text-tertiary">{t("stepLabel", { number: i + 1 })}</p>
                <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why OnlyHulls ─── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            {t("whyTitleStart")} <span className="text-primary">{t("whyTitleAccent")}</span>
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {values.map((v) => (
              <div
                key={v.title}
                className="group rounded-2xl border border-border bg-surface p-8 transition-all hover:border-primary/30"
              >
                <div className="flex items-start gap-5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary/20">
                    <v.Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-primary">{v.stat}</p>
                    <h3 className="mt-1 text-lg font-bold">{v.title}</h3>
                    <p className="mt-2 text-sm text-text-secondary">{v.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Become a Creator (Seller CTA) ─── */}
      <section className="border-y border-border bg-surface/30 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border-bright bg-surface p-10 text-center sm:p-14">
            <h2 className="text-2xl font-bold sm:text-3xl">
              {t("sellerCta.titleStart")} <span className="text-primary">{t("sellerCta.titleAccent")}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-text-secondary">
              {t("sellerCta.description")}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-4 py-2 text-sm text-text-secondary">
              <Clock3 className="h-4 w-4 text-primary" />
              {t("sellerCta.badge")}
            </div>
            <ListBoatCTA
              className="mt-8 inline-block rounded-full bg-accent-btn px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-light hover:shadow-lg hover:shadow-accent/20"
            />
            <p className="mt-3 text-xs text-text-tertiary">
              {t("sellerCta.disclaimer")}
            </p>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            {t("finalCta.titleStart")} <span className="text-primary">{t("finalCta.titleAccent")}</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-text-secondary">
            {t("finalCta.description")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="rounded-full bg-primary-btn px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-light hover:shadow-lg hover:shadow-primary/20"
            >
              {t("finalCta.primary")}
            </Link>
            <Link
              href="/boats"
              className="rounded-full border border-border-bright px-8 py-3 text-sm font-semibold text-foreground transition-all hover:border-primary hover:text-primary"
            >
              {t("finalCta.secondary")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
