import type { Metadata } from "next";
import {
  buildSeoHubMetadata,
  getLocationHub,
  getSeoHubData,
  LOCATION_HUBS,
  requireSeoHub,
} from "@/lib/seo/hubs";
import SeoHubPage from "@/components/seo/SeoHubPage";

export const dynamic = "force-dynamic";

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
  return buildSeoHubMetadata(hub);
}

export default async function LocationHubPage({
  params,
}: {
  params: Promise<{ locationSlug: string }>;
}) {
  const { locationSlug } = await params;
  const hub = requireSeoHub(getLocationHub(locationSlug));
  const data = await getSeoHubData(hub);

  return <SeoHubPage hub={hub} boats={data.boats} total={data.total} />;
}
