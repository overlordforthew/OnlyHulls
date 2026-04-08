import { query, queryOne } from "@/lib/db";
import { getMeili, BOATS_INDEX } from "@/lib/meilisearch";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";

export type BoatSearchDocument = {
  id: string;
  make: string;
  model: string;
  year: number;
  askingPrice: number;
  currency: string;
  locationText: string | null;
  sourceName: string | null;
  sourceSite: string | null;
  status: string;
  specs: Record<string, unknown>;
  characterTags: string[];
  description: string;
};

type BoatSearchRow = {
  id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  location_text: string | null;
  source_name: string | null;
  source_site: string | null;
  status: string;
  specs: Record<string, unknown>;
  character_tags: string[];
  ai_summary: string | null;
};

const BOAT_SEARCH_FILTERS = ["status", "askingPrice", "year"];

export async function ensureBoatSearchIndex() {
  const meili = getMeili();
  const index = meili.index(BOATS_INDEX);

  await meili.createIndex(BOATS_INDEX, { primaryKey: "id" }).catch(() => null);
  await index.updateFilterableAttributes(BOAT_SEARCH_FILTERS).catch(() => null);

  return index;
}

export async function getActiveBoatSearchDocuments(): Promise<BoatSearchDocument[]> {
  const boats = await query<BoatSearchRow>(
    `SELECT b.id, b.make, b.model, b.year, b.asking_price, b.currency, b.location_text,
            b.source_name, b.source_site, b.status,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.ai_summary
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}
     ORDER BY b.created_at DESC, b.id`
  );

  return boats.map(toBoatSearchDocument);
}

export async function syncBoatSearchDocument(boatId: string) {
  const index = await ensureBoatSearchIndex();

  const boat = await queryOne<BoatSearchRow>(
    `SELECT b.id, b.make, b.model, b.year, b.asking_price, b.currency, b.location_text,
            b.source_name, b.source_site, b.status,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.ai_summary
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.id = $1
       AND b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}`,
    [boatId]
  );

  if (!boat) {
    await index.deleteDocument(boatId).catch(() => null);
    return { action: "deleted" as const };
  }

  await index.addDocuments([toBoatSearchDocument(boat)]);
  return { action: "upserted" as const };
}

function toBoatSearchDocument(boat: BoatSearchRow): BoatSearchDocument {
  return {
    id: boat.id,
    make: boat.make,
    model: boat.model,
    year: boat.year,
    askingPrice: Number(boat.asking_price),
    currency: boat.currency,
    locationText: boat.location_text,
    sourceName: boat.source_name,
    sourceSite: boat.source_site,
    status: boat.status,
    specs: boat.specs || {},
    characterTags: boat.character_tags || [],
    description: boat.ai_summary || "",
  };
}
