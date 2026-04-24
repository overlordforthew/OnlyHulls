import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import SeoHubPage from "@/components/seo/SeoHubPage";
import { localizeSeoHubDefinition } from "@/i18n/copy/seo";
import {
  buildSeoHubMetadata,
  getSeoHubData,
  listProgrammaticHubSlugs,
  resolveProgrammaticHub,
} from "@/lib/seo/hubs";
import { getSeoHubBoatCount } from "@/lib/db/queries";

export const revalidate = 300;

export async function generateStaticParams() {
  return listProgrammaticHubSlugs().map((programmaticSlug) => ({ programmaticSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ programmaticSlug: string }>;
}): Promise<Metadata> {
  const { programmaticSlug } = await params;
  const hub = resolveProgrammaticHub(programmaticSlug);
  if (!hub) return { title: "Not found", robots: { index: false, follow: false } };
  const locale = await getLocale();
  const inventoryCount = await getSeoHubBoatCount(hub.queryWhere, hub.queryParams || []);
  return buildSeoHubMetadata(localizeSeoHubDefinition(locale, hub), { inventoryCount, locale });
}

export default async function ProgrammaticHubPage({
  params,
}: {
  params: Promise<{ programmaticSlug: string }>;
}) {
  const { programmaticSlug } = await params;
  const hub = resolveProgrammaticHub(programmaticSlug);
  if (!hub) notFound();
  const data = await getSeoHubData(hub);
  return (
    <SeoHubPage
      hub={hub}
      boats={data.boats}
      total={data.total}
      locationBounds={data.locationBounds}
    />
  );
}
