import { pool, query, queryOne } from "@/lib/db";
import { generateListingSlug, ensureUniqueListingSlug } from "@/lib/listings/shared";
import { sanitizeImportedBoatRecord } from "@/lib/import-quality";

type ClaimableBoatRow = {
  id: string;
  slug: string | null;
  year: number;
  make: string;
  model: string;
  asking_price: number;
  currency: string;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_country: string | null;
  location_region: string | null;
  location_market_slugs: string[];
  location_confidence: string;
  location_approximate: boolean;
  hull_id: string | null;
  source_name: string | null;
  source_site: string | null;
  source_url: string | null;
  status: string;
  seller_id: string;
  specs: Record<string, unknown>;
  character_tags: string[];
  condition_score: number | null;
  ai_summary: string | null;
};

type ClaimantRow = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  subscription_tier: string;
};

type ClaimDraftRow = {
  id: string;
  slug: string | null;
  status: string;
};

export type ClaimDraftResult = {
  claimId: string;
  draftBoatId: string;
  draftBoatSlug: string | null;
  boatTitle: string;
  sourceName: string | null;
  autoUpgradedToSeller: boolean;
  existingDraft: boolean;
};

export type ClaimQueueRow = {
  id: string;
  status: "draft_created" | "reviewing" | "approved" | "rejected";
  note: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  boat_id: string;
  boat_slug: string | null;
  boat_title: string;
  boat_source_name: string | null;
  boat_source_site: string | null;
  boat_location_text: string | null;
  claimant_user_id: string;
  claimant_email: string;
  claimant_display_name: string | null;
  claimed_listing_id: string | null;
  claimed_listing_slug: string | null;
  claimed_listing_status: string | null;
};

function isSellerRole(role: string) {
  return role === "seller" || role === "both" || role === "admin";
}

function getSellerUpgrade(role: string, tier: string) {
  if (isSellerRole(role)) {
    return { kind: "none" as const };
  }

  if (tier === "free") {
    return {
      kind: "upgrade" as const,
      role: "both",
      subscriptionTier: "free-seller",
    };
  }

  return {
    kind: "blocked" as const,
    message:
      "Seller access is not merged into this buyer plan yet. Switch the account onto a seller plan first, then claim the listing.",
  };
}

function toBoatTitle(boat: Pick<ClaimableBoatRow, "year" | "make" | "model">) {
  return `${boat.year} ${boat.make} ${boat.model}`.trim();
}

async function getClaimableBoat(boatId: string) {
  const boat = await queryOne<ClaimableBoatRow>(
    `SELECT b.id, b.slug, b.year, b.make, b.model, b.asking_price, b.currency,
            b.location_text, b.location_lat, b.location_lng,
            b.location_country, b.location_region,
            COALESCE(b.location_market_slugs, '{}') AS location_market_slugs,
            b.location_confidence, b.location_approximate,
            b.hull_id,
            b.source_name, b.source_site, b.source_url, b.status, b.seller_id,
            COALESCE(d.specs, '{}') AS specs,
            COALESCE(d.character_tags, '{}') AS character_tags,
            d.condition_score,
            d.ai_summary
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.id = $1
       AND b.listing_source = 'imported'
       AND b.source_url IS NOT NULL`,
    [boatId]
  );

  if (!boat) {
    return null;
  }

  return sanitizeImportedBoatRecord({
    ...boat,
    specs: boat.specs || {},
  }) as ClaimableBoatRow;
}

export async function createClaimDraftForBoat(input: {
  boatId: string;
  claimantUserId: string;
}) {
  const claimant = await queryOne<ClaimantRow>(
    `SELECT id, email, display_name, role, subscription_tier
     FROM users
     WHERE id = $1`,
    [input.claimantUserId]
  );
  if (!claimant) {
    throw new Error("User not found");
  }

  const sourceBoat = await getClaimableBoat(input.boatId);
  if (!sourceBoat || sourceBoat.status !== "active") {
    throw new Error("Boat not found");
  }

  const existingClaim = await queryOne<ClaimDraftRow & { claim_id: string }>(
    `SELECT bcr.id AS claim_id,
            bcr.status,
            b.id,
            b.slug
     FROM boat_claim_requests bcr
     LEFT JOIN boats b ON b.id = bcr.claimed_listing_id
     WHERE bcr.boat_id = $1
       AND bcr.claimant_user_id = $2
     LIMIT 1`,
    [sourceBoat.id, claimant.id]
  );

  if (existingClaim?.id) {
    return {
      claimId: existingClaim.claim_id,
      draftBoatId: existingClaim.id,
      draftBoatSlug: existingClaim.slug,
      boatTitle: toBoatTitle(sourceBoat),
      sourceName: sourceBoat.source_name,
      autoUpgradedToSeller: false,
      existingDraft: true,
    } satisfies ClaimDraftResult;
  }

  const upgrade = getSellerUpgrade(claimant.role, claimant.subscription_tier);
  if (upgrade.kind === "blocked") {
    throw new Error(upgrade.message);
  }
  const draftSlug = await ensureUniqueListingSlug(
    generateListingSlug(
      sourceBoat.year,
      sourceBoat.make,
      sourceBoat.model,
      sourceBoat.location_text || undefined
    )
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (upgrade.kind === "upgrade") {
      await client.query(
        "UPDATE users SET role = $1, subscription_tier = $2 WHERE id = $3",
        [upgrade.role, upgrade.subscriptionTier, claimant.id]
      );
    }

    const insertedBoat = await client.query<{ id: string; slug: string | null }>(
      `INSERT INTO boats (
         seller_id, slug, hull_id, make, model, year, asking_price, currency,
         status, location_text, location_lat, location_lng,
         location_country, location_region, location_market_slugs,
         location_confidence, location_approximate,
         listing_source, claimed_from_boat_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10, $11, $12, $13, $14, $15, $16, 'platform', $17)
       RETURNING id, slug`,
      [
        claimant.id,
        draftSlug,
        sourceBoat.hull_id,
        sourceBoat.make,
        sourceBoat.model,
        sourceBoat.year,
        sourceBoat.asking_price,
        sourceBoat.currency,
        sourceBoat.location_text,
        sourceBoat.location_lat,
        sourceBoat.location_lng,
        sourceBoat.location_country,
        sourceBoat.location_region,
        sourceBoat.location_market_slugs || [],
        sourceBoat.location_confidence,
        sourceBoat.location_approximate,
        sourceBoat.id,
      ]
    );

    const draftBoat = insertedBoat.rows[0];
    if (!draftBoat) {
      throw new Error("Failed to create claim draft");
    }

    await client.query(
      `INSERT INTO boat_dna (boat_id, specs, character_tags, condition_score, ai_summary, documentation_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        draftBoat.id,
        JSON.stringify(sourceBoat.specs || {}),
        sourceBoat.character_tags || [],
        sourceBoat.condition_score,
        sourceBoat.ai_summary,
        JSON.stringify({
          claim_source_boat_id: sourceBoat.id,
          claim_source_name: sourceBoat.source_name || null,
          claim_source_site: sourceBoat.source_site || null,
        }),
      ]
    );

    await client.query(
      `INSERT INTO boat_media (boat_id, type, url, thumbnail_url, caption, sort_order)
       SELECT $2, bm.type, bm.url, bm.thumbnail_url, bm.caption, bm.sort_order
       FROM boat_media bm
       WHERE bm.boat_id = $1
       ORDER BY bm.sort_order, bm.id`,
      [sourceBoat.id, draftBoat.id]
    );

    const claimResult = await client.query<{ id: string }>(
      `INSERT INTO boat_claim_requests (
         boat_id, claimant_user_id, claimed_listing_id, status, note
       )
       VALUES ($1, $2, $3, 'draft_created', $4)
       RETURNING id`,
      [
        sourceBoat.id,
        claimant.id,
        draftBoat.id,
        `Claim draft created from ${sourceBoat.source_name || sourceBoat.source_site || "imported inventory"}.`,
      ]
    );

    const claim = claimResult.rows[0];
    if (!claim) {
      throw new Error("Failed to create claim request");
    }

    await client.query("COMMIT");

    return {
      claimId: claim.id,
      draftBoatId: draftBoat.id,
      draftBoatSlug: draftBoat.slug,
      boatTitle: toBoatTitle(sourceBoat),
      sourceName: sourceBoat.source_name,
      autoUpgradedToSeller: upgrade.kind === "upgrade",
      existingDraft: false,
    } satisfies ClaimDraftResult;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listClaimRequests(options?: {
  status?: ClaimQueueRow["status"] | "all";
  limit?: number;
}) {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const params: unknown[] = [];
  const where: string[] = [];

  if (options?.status && options.status !== "all") {
    params.push(options.status);
    where.push(`bcr.status = $${params.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  return query<ClaimQueueRow>(
    `SELECT bcr.id,
            bcr.status,
            bcr.note,
            bcr.created_at,
            bcr.updated_at,
            bcr.reviewed_at,
            b.id AS boat_id,
            b.slug AS boat_slug,
            CONCAT(b.year, ' ', b.make, ' ', b.model) AS boat_title,
            b.source_name AS boat_source_name,
            b.source_site AS boat_source_site,
            b.location_text AS boat_location_text,
            claimant.id AS claimant_user_id,
            claimant.email AS claimant_email,
            claimant.display_name AS claimant_display_name,
            claimed.id AS claimed_listing_id,
            claimed.slug AS claimed_listing_slug,
            claimed.status AS claimed_listing_status
     FROM boat_claim_requests bcr
     JOIN boats b ON b.id = bcr.boat_id
     JOIN users claimant ON claimant.id = bcr.claimant_user_id
     LEFT JOIN boats claimed ON claimed.id = bcr.claimed_listing_id
     ${whereClause}
     ORDER BY bcr.created_at DESC
     LIMIT ${limit}`,
    params
  );
}

export async function updateClaimRequestStatus(input: {
  claimId: string;
  status: ClaimQueueRow["status"];
  reviewerUserId: string;
}) {
  return queryOne<{ id: string; status: ClaimQueueRow["status"] }>(
    `UPDATE boat_claim_requests
     SET status = $1,
         reviewed_by = $2,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $3
     RETURNING id, status`,
    [input.status, input.reviewerUserId, input.claimId]
  );
}
