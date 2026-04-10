import type { Metadata } from "next";
import { buildSeoHubMetadata, getMakeHub, getSeoHubData, MAKE_HUBS, requireSeoHub } from "@/lib/seo/hubs";
import SeoHubPage from "@/components/seo/SeoHubPage";

export const dynamic = "force-dynamic";

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
  return buildSeoHubMetadata(hub);
}

export default async function MakeHubPage({
  params,
}: {
  params: Promise<{ makeSlug: string }>;
}) {
  const { makeSlug } = await params;
  const hub = requireSeoHub(getMakeHub(makeSlug));
  const data = await getSeoHubData(hub);

  return <SeoHubPage hub={hub} boats={data.boats} total={data.total} />;
}

