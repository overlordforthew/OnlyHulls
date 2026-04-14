import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { query, queryOne } from "@/lib/db";
import { getMeili } from "@/lib/meilisearch";
import { computeAllMatches } from "@/lib/matching/engine";
import {
  ensureBoatSearchIndex,
  getActiveBoatSearchDocuments,
  syncBoatSearchDocument,
} from "@/lib/search/boat-index";

const execFile = promisify(execFileCallback);

function parseCleanupResult(stdout: string) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line) as {
        processed?: number;
        llmUsed?: number;
        visibleInBatch?: number;
        hiddenInBatch?: number;
        embeddingsUpdated?: number;
        reindexed?: number;
        visibleActiveCount?: number;
      };
    } catch {
      continue;
    }
  }

  return null;
}

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

export async function cleanImportedListings(limit = 500) {
  const repoRoot = process.cwd();
  const tsxCliPath = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const scriptPath = path.join(repoRoot, "scripts", "clean-imported-data.ts");

  const { stdout, stderr } = await execFile(
    process.execPath,
    [tsxCliPath, scriptPath, "--skip-embeddings", "--limit", String(limit)],
    {
      cwd: repoRoot,
      timeout: 15 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  const result = parseCleanupResult(stdout);

  return {
    processed: result?.processed ?? 0,
    llmUsed: result?.llmUsed ?? 0,
    visibleInBatch: result?.visibleInBatch ?? 0,
    hiddenInBatch: result?.hiddenInBatch ?? 0,
    embeddingsUpdated: result?.embeddingsUpdated ?? 0,
    visibleActiveCount: result?.visibleActiveCount ?? 0,
    stderr: stderr.trim() || null,
  };
}
