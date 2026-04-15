import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import SeoHubPage from "@/components/seo/SeoHubPage";
import { localizeSeoHubDefinition } from "@/i18n/copy/seo";
import { buildSeoHubMetadata, getCategoryHub, getSeoHubData, requireSeoHub } from "@/lib/seo/hubs";

const hub = requireSeoHub(getCategoryHub("sailboats-for-sale"));

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return buildSeoHubMetadata(localizeSeoHubDefinition(locale, hub));
}

export default async function SailboatsForSalePage() {
  const data = await getSeoHubData(hub);
  return <SeoHubPage hub={hub} boats={data.boats} total={data.total} />;
}
