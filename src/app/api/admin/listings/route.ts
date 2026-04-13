import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "pending_review";
    const search = (url.searchParams.get("q") || "").trim();
    const source = (url.searchParams.get("source") || "").trim();
    const issue = (url.searchParams.get("issue") || "").trim();
    const sort = (url.searchParams.get("sort") || "newest").trim();
    const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
    const params: unknown[] = [];
    const where: string[] = [];

    if (status !== "all") {
      params.push(status);
      where.push(`b.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(CONCAT_WS(' ', b.year::text, b.make, b.model, b.location_text, u.email, COALESCE(b.source_name, '')) ILIKE $${params.length})`
      );
    }

    if (source && source !== "all") {
      params.push(source);
      where.push(`COALESCE(b.source_name, 'Platform') = $${params.length}`);
    }

    if (issue && issue !== "all") {
      if (issue === "missing_description") {
        where.push(`NULLIF(TRIM(COALESCE(d.ai_summary, '')), '') IS NULL`);
      } else if (issue === "low_condition") {
        where.push(`COALESCE(d.condition_score, 0) < 6`);
      } else if (issue === "cleanup_needed") {
        where.push(`(
          COALESCE((d.documentation_status->>'import_quality_score')::int, 100) < 90
          OR COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) <> '[]'::jsonb
          OR NULLIF(TRIM(COALESCE(d.ai_summary, '')), '') IS NULL
          OR COALESCE(d.condition_score, 0) < 6
        )`);
      } else {
        params.push(issue);
        where.push(
          `COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? $${params.length}`
        );
      }
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const qualityScoreSql = `COALESCE((d.documentation_status->>'import_quality_score')::int, 100)`;
    const imageCountSql = `COALESCE(media_counts.image_count, 0)::int`;
    const orderBy =
      sort === "quality"
        ? `${qualityScoreSql} ASC, ${imageCountSql} ASC, b.created_at DESC`
        : "b.created_at DESC";

    const listings = await query<Record<string, unknown>>(
      `SELECT b.id, b.slug, b.make, b.model, b.year, b.asking_price, b.currency,
              b.location_text, b.status, b.created_at, b.listing_source,
              COALESCE(b.source_name, 'Platform') AS source_name,
              u.email as seller_email,
              COALESCE(media_counts.image_count, 0)::int AS image_count,
              COALESCE(media_counts.video_count, 0)::int AS video_count,
              COALESCE(d.condition_score, 0)::numeric AS condition_score,
              NULLIF(TRIM(COALESCE(d.ai_summary, '')), '') IS NOT NULL AS has_description,
              COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) AS quality_flags,
              COALESCE((d.documentation_status->>'import_quality_score')::int, 100) AS quality_score
       FROM boats b
       JOIN users u ON u.id = b.seller_id
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       LEFT JOIN (
         SELECT boat_id,
                COUNT(*) FILTER (WHERE type = 'image') AS image_count,
                COUNT(*) FILTER (WHERE type = 'video') AS video_count
         FROM boat_media
         GROUP BY boat_id
       ) media_counts ON media_counts.boat_id = b.id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ${limit}`,
      params
    );

    return NextResponse.json({ listings });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/listings error");
    return NextResponse.json(
      { error: "Failed to load listings" },
      { status: 500 }
    );
  }
}
