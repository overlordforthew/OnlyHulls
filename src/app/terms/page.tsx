import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("termsPage");

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function TermsPage() {
  const t = await getTranslations("termsPage");

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold">{t("heading")}</h1>
      <p className="mt-2 text-sm text-text-secondary">{t("lastUpdated")}</p>

      <div className="mt-8 space-y-8 text-foreground/80 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.acceptance.title")}</h2>
          <p className="mt-3">
            {t("sections.acceptance.body")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.service.title")}</h2>
          <p className="mt-3">
            {t("sections.service.body")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.accounts.title")}</h2>
          <p className="mt-3">
            {t("sections.accounts.body")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.transactions.title")}</h2>
          <p className="mt-3">
            {t("sections.transactions.body")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.thirdParty.title")}</h2>
          <p className="mt-3">
            {t("sections.thirdParty.body")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.ai.title")}</h2>
          <p className="mt-3">
            {t("sections.ai.body")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.liability.title")}</h2>
          <p className="mt-3">
            {t("sections.liability.body")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.contact.title")}</h2>
          <p className="mt-3">
            {t("sections.contact.body")}{" "}
            <a href="mailto:hello@onlyhulls.com" className="text-primary hover:underline">
              hello@onlyhulls.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
