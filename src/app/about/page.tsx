import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Waves, Sparkles, Heart, Shield } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aboutPage");

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function AboutPage() {
  const t = await getTranslations("aboutPage");

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <div className="flex items-center gap-3">
        <Waves className="h-8 w-8 text-primary" strokeWidth={2.5} />
        <h1 className="text-3xl font-bold">
          {t("heading")}
        </h1>
      </div>

      <div className="mt-8 space-y-6 text-foreground/80 leading-relaxed">
        <p className="text-lg">
          {t("intro")}
        </p>

        <p>
          {t("problem")}
        </p>

        <p>
          {t("solution")}
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5">
          <Sparkles className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-semibold">{t("cards.matching.title")}</h3>
          <p className="mt-2 text-sm text-text-secondary">
            {t("cards.matching.description")}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <Heart className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-semibold">{t("cards.commission.title")}</h3>
          <p className="mt-2 text-sm text-text-secondary">
            {t("cards.commission.description")}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <Shield className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-semibold">{t("cards.boats.title")}</h3>
          <p className="mt-2 text-sm text-text-secondary">
            {t("cards.boats.description")}
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">{t("contactHeading")}</h2>
        <p className="mt-3 text-text-secondary">
          {t("contactDescription")}{" "}
          <a href="mailto:hello@onlyhulls.com" className="text-primary hover:underline">
            hello@onlyhulls.com
          </a>.
        </p>
      </div>
    </div>
  );
}
