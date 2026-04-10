import { buildSeoHubMetadata, getCategoryHub, getSeoHubData, requireSeoHub } from "@/lib/seo/hubs";
import SeoHubPage from "@/components/seo/SeoHubPage";

const hub = requireSeoHub(getCategoryHub("sailboats-for-sale"));

export const dynamic = "force-dynamic";
export const metadata = buildSeoHubMetadata(hub);

export default async function SailboatsForSalePage() {
  const data = await getSeoHubData(hub);
  return <SeoHubPage hub={hub} boats={data.boats} total={data.total} />;
}
