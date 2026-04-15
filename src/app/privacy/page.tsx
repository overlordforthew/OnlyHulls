import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacyPage");

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacyPage");

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-bold">{t("heading")}</h1>
      <p className="mt-2 text-sm text-text-secondary">{t("lastUpdated")}</p>

      <div className="mt-8 space-y-8 text-foreground/80 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.informationCollected.title")}</h2>
          <p className="mt-3">
            {t("sections.informationCollected.accountData")}
          </p>
          <p className="mt-2">
            {t("sections.informationCollected.buyerProfile")}
          </p>
          <p className="mt-2">
            {t("sections.informationCollected.usageData")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.howWeUse.title")}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>{t("sections.howWeUse.items.one")}</li>
            <li>{t("sections.howWeUse.items.two")}</li>
            <li>{t("sections.howWeUse.items.three")}</li>
            <li>{t("sections.howWeUse.items.four")}</li>
            <li>{t("sections.howWeUse.items.five")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.sharing.title")}</h2>
          <p className="mt-3">
            {t("sections.sharing.intro")}
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            <li>{t("sections.sharing.seller")}</li>
            <li>{t("sections.sharing.providers")}</li>
            <li>{t("sections.sharing.legal")}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.security.title")}</h2>
          <p className="mt-3">
            {t("sections.security.body")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.rights.title")}</h2>
          <p className="mt-3">
            {t("sections.rights.body")}
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">{t("sections.cookies.title")}</h2>
          <p className="mt-3">
            {t("sections.cookies.body")}
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
