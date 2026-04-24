import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import SeoHubPage from "@/components/seo/SeoHubPage";
import { localizeSeoHubDefinition } from "@/i18n/copy/seo";
import { buildSeoHubMetadata, getCategoryHub, getSeoHubData, requireSeoHub } from "@/lib/seo/hubs";
import { getSeoHubBoatCount } from "@/lib/db/queries";

const hub = requireSeoHub(getCategoryHub("sailboats-for-sale"));

// Keep hub HTML cached for 5 minutes — crawler hits and repeat visits stop
// hammering the DB, and inventory staleness at 300s is acceptable for a
// marketplace whose expiry cadence is measured in days.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const inventoryCount = await getSeoHubBoatCount(hub.queryWhere, hub.queryParams || []);
  return buildSeoHubMetadata(localizeSeoHubDefinition(locale, hub), { inventoryCount, locale });
}

export default async function SailboatsForSalePage() {
  const data = await getSeoHubData(hub);
  return <SeoHubPage hub={hub} boats={data.boats} total={data.total} locationBounds={data.locationBounds} />;
}
