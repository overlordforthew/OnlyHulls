import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { localizeSeoHubLink } from "@/i18n/copy/seo";
import { buildSeoHubLinks, type SeoHubLink } from "@/lib/seo/hub-links";

interface SeoHubLinksProps {
  links?: SeoHubLink[];
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export default function SeoHubLinks({
  links = buildSeoHubLinks("__none__"),
  title,
  subtitle,
  compact = false,
}: SeoHubLinksProps) {
  const t = useTranslations("seoHubLinks");
  const locale = useLocale();
  const resolvedTitle = title || t("title");
  const resolvedSubtitle = subtitle || t("subtitle");
  const localizedLinks = links.map((link) => localizeSeoHubLink(locale, link));

  return (
    <section className={compact ? "" : "border-y border-border bg-surface/30 py-14 sm:py-16"}>
      <div className="mx-auto max-w-7xl px-5">
        <div className={compact ? "mb-4" : "text-center"}>
          <h2 className={`font-bold ${compact ? "text-lg" : "text-2xl"}`}>{resolvedTitle}</h2>
          <p className={`text-text-secondary ${compact ? "mt-1 text-sm" : "mx-auto mt-3 max-w-2xl"}`}>
            {resolvedSubtitle}
          </p>
        </div>

        <div className={`grid gap-4 ${compact ? "mt-4 sm:grid-cols-2 lg:grid-cols-3" : "mt-8 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {localizedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-2xl border border-border bg-surface p-5 transition-all hover:border-primary/30 hover:bg-surface-elevated"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
                  {link.label}
                </h3>
                <ArrowRight className="h-4 w-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <p className="mt-2 text-sm text-text-secondary">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
