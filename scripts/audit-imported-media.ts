import { pool, query } from "../src/lib/db";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import { classifyExternalImageFetch, type MediaFetchStatus } from "../src/lib/media-health";

type MediaAuditRow = {
  id: string;
  boat_id: string;
  url: string;
  source_name: string | null;
  fetch_status: MediaFetchStatus;
};

type MediaAuditResult = {
  id: string;
  boatId: string;
  url: string;
  sourceName: string | null;
  fetchStatus: MediaFetchStatus;
  httpStatus: number | null;
  contentType: string | null;
  contentLength: number | null;
  blockedReason: string | null;
};

const DEFAULT_LIMIT = 25;
const DEFAULT_TIMEOUT_MS = 10_000;
const FETCH_RANGE_BYTES = 65_535;

function parseArgValue(name: string, fallback: string) {
  const withEquals = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (withEquals) {
    return withEquals.slice(name.length + 1) || fallback;
  }

  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchImageHealth(url: string, timeoutMs: number): Promise<Omit<MediaAuditResult, "id" | "boatId" | "url" | "sourceName" | "fetchStatus"> & { fetchStatus: MediaFetchStatus }> {
  if (!isHttpUrl(url)) {
    return {
      fetchStatus: "blocked",
      httpStatus: null,
      contentType: null,
      contentLength: null,
      blockedReason: "unsupported_url",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Range: `bytes=0-${FETCH_RANGE_BYTES}`,
        "User-Agent": "OnlyHullsMediaAudit/1.0 (https://onlyhulls.com)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const classification = classifyExternalImageFetch({
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      byteLength: bytes.byteLength,
    });
    const contentLengthHeader = response.headers.get("content-length");
    const parsedContentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : bytes.byteLength;

    return {
      fetchStatus: classification.fetchStatus,
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      contentLength: Number.isFinite(parsedContentLength) ? parsedContentLength : bytes.byteLength,
      blockedReason: classification.blockedReason,
    };
  } catch (err) {
    return {
      fetchStatus: "failed",
      httpStatus: null,
      contentType: null,
      contentLength: null,
      blockedReason: err instanceof Error && err.name === "AbortError" ? "timeout" : "fetch_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function applyAuditResult(result: MediaAuditResult) {
  await query(
    `UPDATE boat_media
     SET fetch_status = $2,
         http_status = $3,
         content_type = $4,
         content_length = $5,
         blocked_reason = $6,
         last_checked_at = NOW()
     WHERE id = $1`,
    [
      result.id,
      result.fetchStatus,
      result.httpStatus,
      result.contentType,
      result.contentLength,
      result.blockedReason,
    ]
  );
}

function printTable(results: MediaAuditResult[], applied: boolean) {
  console.log(`Imported media audit (${applied ? "applied" : "dry run"})`);
  console.log("status | http | type | bytes | reason | source | url");
  for (const result of results) {
    console.log(
      [
        result.fetchStatus,
        result.httpStatus ?? "-",
        result.contentType ?? "-",
        result.contentLength ?? "-",
        result.blockedReason ?? "-",
        result.sourceName ?? "Platform",
        result.url,
      ].join(" | ")
    );
  }

  const summary = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.fetchStatus] = (acc[result.fetchStatus] || 0) + 1;
    return acc;
  }, {});
  console.log(`Summary: ${JSON.stringify(summary)}`);
}

async function main() {
  const limit = parsePositiveInt(parseArgValue("--limit", String(DEFAULT_LIMIT)), DEFAULT_LIMIT);
  const timeoutMs = parsePositiveInt(
    parseArgValue("--timeout-ms", String(DEFAULT_TIMEOUT_MS)),
    DEFAULT_TIMEOUT_MS
  );
  const apply = hasFlag("--apply");
  const json = hasFlag("--json");

  const rows = await query<MediaAuditRow>(
    `SELECT bm.id, bm.boat_id, bm.url, COALESCE(b.source_name, 'Platform') AS source_name,
            COALESCE(bm.fetch_status, 'unchecked') AS fetch_status
     FROM boat_media bm
     JOIN boats b ON b.id = bm.boat_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE bm.type = 'image'
       AND bm.url ~* '^https?://'
       AND b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}
     ORDER BY
       CASE COALESCE(bm.fetch_status, 'unchecked')
         WHEN 'failed' THEN 0
         WHEN 'blocked' THEN 1
         WHEN 'unchecked' THEN 2
         ELSE 3
       END,
       bm.last_checked_at ASC NULLS FIRST,
       bm.sort_order ASC,
       bm.id ASC
     LIMIT $1`,
    [limit]
  );

  const results: MediaAuditResult[] = [];

  for (const row of rows) {
    const health = await fetchImageHealth(row.url, timeoutMs);
    const result = {
      id: row.id,
      boatId: row.boat_id,
      url: row.url,
      sourceName: row.source_name,
      ...health,
    };
    results.push(result);

    if (apply) {
      await applyAuditResult(result);
    }
  }

  if (json) {
    console.log(JSON.stringify({ applied: apply, results }, null, 2));
    return;
  }

  printTable(results, apply);
}

main()
  .catch((err) => {
    console.error("Imported media audit failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
