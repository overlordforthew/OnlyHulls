import { query, queryOne } from "@/lib/db";
import { getMeili, BOATS_INDEX } from "@/lib/meilisearch";
import { computeAllMatches } from "@/lib/matching/engine";

type SearchDocument = {
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

export async function bulkUpdateListingStatus(
  status: "active" | "rejected" | "pending_review",
  ids?: string[]
) {
  const params: unknown[] = [status];
  let whereClause = "status = 'pending_review'";

  if (ids?.length) {
    whereClause = "id = ANY($2)";
    params.push(ids);
  }

  const result = await queryOne<{ count: string }>(
    `WITH updated AS (
       UPDATE boats
       SET status = $1, updated_at = NOW()
       WHERE ${whereClause}
       RETURNING id
     )
     SELECT COUNT(*)::text AS count FROM updated`,
    params
  );

  return { updated: parseInt(result?.count || "0", 10) };
}

export async function backfillAllMatches() {
  const result = await computeAllMatches();
  const matches = await queryOne<{ count: string }>("SELECT COUNT(*) FROM matches");

  return {
    ...result,
    totalMatches: parseInt(matches?.count || "0", 10),
  };
}

export async function reindexBoatSearch() {
  const index = getMeili().index(BOATS_INDEX);
  const batchSize = 1000;

  const boats = await query<{
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
  }>(
    `SELECT b.id, b.make, b.model, b.year, b.asking_price, b.currency, b.location_text,
            b.source_name, b.source_site, b.status,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.ai_summary
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
     ORDER BY b.created_at DESC, b.id`
  );

  await getMeili()
    .createIndex(BOATS_INDEX, { primaryKey: "id" })
    .catch(() => null);
  await index.updateFilterableAttributes(["status", "askingPrice", "year"]);
  const deleteTask = await index.deleteAllDocuments().catch(() => null);
  if (deleteTask) {
    await getMeili().tasks.waitForTask(deleteTask.taskUid);
  }

  let indexed = 0;

  for (let i = 0; i < boats.length; i += batchSize) {
    const docs: SearchDocument[] = boats.slice(i, i + batchSize).map((boat) => ({
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
    }));

    const task = await index.addDocuments(docs);
    await getMeili().tasks.waitForTask(task.taskUid);
    indexed += docs.length;
  }

  return { indexed };
}
