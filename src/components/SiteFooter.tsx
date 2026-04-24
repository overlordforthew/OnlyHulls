import Link from "@/components/LocaleLink";
import { useTranslations } from "next-intl";
import { Waves } from "lucide-react";

export default function SiteFooter() {
  const t = useTranslations("siteFooter");
  return (
    <footer className="border-t border-border bg-surface">
      {/* Gradient top accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Browse */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              {t("browse")}
            </h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/boats" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("allBoats")}</Link></li>
              <li><Link href="/boats?tag=bluewater" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("cruising")}</Link></li>
              <li><Link href="/boats?tag=liveaboard-ready" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("liveaboard")}</Link></li>
              <li><Link href="/boats?tag=race-ready" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("racing")}</Link></li>
              <li><Link href="/boats?tag=classic" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("classic")}</Link></li>
            </ul>
          </div>

          {/* Sellers */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              {t("sellers")}
            </h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/sell" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("listYourBoat")}</Link></li>
              <li><Link href="/sell#pricing" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("sellerPricing")}</Link></li>
              <li><Link href="/sign-up?role=seller" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("createAccount")}</Link></li>
            </ul>
          </div>

          {/* Buyers */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              {t("buyers")}
            </h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/match" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("aiMatching")}</Link></li>
              <li><Link href="/match#pricing" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("buyerPlans")}</Link></li>
              <li><Link href="/sign-up?role=buyer" className="text-sm text-text-secondary hover:text-primary transition-colors">{t("getStarted")}</Link></li>
            </ul>
          </div>

          {/* Brand & Legal */}
          <div>
            <div className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-primary" strokeWidth={2.5} />
              <span className="text-lg font-bold">
                <span className="text-foreground">Only</span>
                <span className="text-primary">Hulls</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-text-tertiary">
              {t("brandTagline")}
            </p>
            <ul className="mt-4 space-y-2">
              <li><Link href="/about" className="text-xs text-text-tertiary hover:text-primary transition-colors">{t("about")}</Link></li>
              <li><Link href="/terms" className="text-xs text-text-tertiary hover:text-primary transition-colors">{t("terms")}</Link></li>
              <li><Link href="/privacy" className="text-xs text-text-tertiary hover:text-primary transition-colors">{t("privacy")}</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-xs text-text-tertiary">
            {"\u00A9"} {new Date().getFullYear()} OnlyHulls. {t("rightsReserved")}
          </p>
          <p className="text-xs text-text-tertiary">
            {t("bottomTagline")}
          </p>
        </div>
      </div>
    </footer>
  );
}
