import Link from "@/components/LocaleLink";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="text-6xl">⛵</span>
      <h1 className="mt-6 text-4xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-lg text-text-secondary">
        {t("description")}
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/boats"
          className="rounded-full bg-primary px-6 py-3 font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          {t("browseBoats")}
        </Link>
        <Link
          href="/"
          className="rounded-full border border-border px-6 py-3 font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          {t("goHome")}
        </Link>
      </div>
    </main>
  );
}
