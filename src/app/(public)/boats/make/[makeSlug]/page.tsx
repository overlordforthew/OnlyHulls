import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { localizeSeoHubDefinition } from "@/i18n/copy/seo";
import { buildSeoHubMetadata, getMakeHub, getSeoHubData, MAKE_HUBS, requireSeoHub } from "@/lib/seo/hubs";
import { getSeoHubBoatCount } from "@/lib/db/queries";
import SeoHubPage from "@/components/seo/SeoHubPage";

export const revalidate = 300;

export async function generateStaticParams() {
  return Object.keys(MAKE_HUBS).map((makeSlug) => ({ makeSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ makeSlug: string }>;
}): Promise<Metadata> {
  const { makeSlug } = await params;
  const hub = requireSeoHub(getMakeHub(makeSlug));
  const locale = await getLocale();
  const inventoryCount = await getSeoHubBoatCount(hub.queryWhere, hub.queryParams || []);
  return buildSeoHubMetadata(localizeSeoHubDefinition(locale, hub), { inventoryCount });
}

export default async function MakeHubPage({
  params,
}: {
  params: Promise<{ makeSlug: string }>;
}) {
  const { makeSlug } = await params;
  const hub = requireSeoHub(getMakeHub(makeSlug));
  const data = await getSeoHubData(hub);

  return <SeoHubPage hub={hub} boats={data.boats} total={data.total} locationBounds={data.locationBounds} />;
}

