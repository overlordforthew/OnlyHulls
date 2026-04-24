import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { localizeSeoHubDefinition } from "@/i18n/copy/seo";
import {
  buildSeoHubMetadata,
  getLocationHub,
  getSeoHubData,
  LOCATION_HUBS,
  requireSeoHub,
} from "@/lib/seo/hubs";
import { getSeoHubBoatCount } from "@/lib/db/queries";
import SeoHubPage from "@/components/seo/SeoHubPage";

export const revalidate = 300;

export async function generateStaticParams() {
  return Object.keys(LOCATION_HUBS).map((locationSlug) => ({ locationSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locationSlug: string }>;
}): Promise<Metadata> {
  const { locationSlug } = await params;
  const hub = requireSeoHub(getLocationHub(locationSlug));
  const locale = await getLocale();
  const inventoryCount = await getSeoHubBoatCount(hub.queryWhere, hub.queryParams || []);
  return buildSeoHubMetadata(localizeSeoHubDefinition(locale, hub), { inventoryCount, locale });
}

export default async function LocationHubPage({
  params,
}: {
  params: Promise<{ locationSlug: string }>;
}) {
  const { locationSlug } = await params;
  const hub = requireSeoHub(getLocationHub(locationSlug));
  const data = await getSeoHubData(hub);

  return <SeoHubPage hub={hub} boats={data.boats} total={data.total} locationBounds={data.locationBounds} />;
}
