import { query, queryOne } from "@/lib/db";
import { getMeili } from "@/lib/meilisearch";
import { computeAllMatches } from "@/lib/matching/engine";
import {
  ensureBoatSearchIndex,
  getActiveBoatSearchDocuments,
  syncBoatSearchDocument,
} from "@/lib/search/boat-index";

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

  const updatedRows = await query<{ id: string }>(
    `UPDATE boats
     SET status = $1, updated_at = NOW()
     WHERE ${whereClause}
     RETURNING id`,
    params
  );

  await Promise.all(updatedRows.map((row) => syncBoatSearchDocument(row.id)));

  return { updated: updatedRows.length };
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
  const index = await ensureBoatSearchIndex();
  const batchSize = 1000;
  const documents = await getActiveBoatSearchDocuments();

  const deleteTask = await index.deleteAllDocuments().catch(() => null);
  if (deleteTask) {
    await getMeili().tasks.waitForTask(deleteTask.taskUid);
  }

  let indexed = 0;

  for (let i = 0; i < documents.length; i += batchSize) {
    const task = await index.addDocuments(documents.slice(i, i + batchSize));
    await getMeili().tasks.waitForTask(task.taskUid);
    indexed += Math.min(batchSize, documents.length - i);
  }

  return { indexed };
}
