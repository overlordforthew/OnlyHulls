import bcrypt from "bcryptjs";
import { pool, query, queryOne } from "../src/lib/db";

const email = process.env.PLAYWRIGHT_SELLER_EMAIL;
const password = process.env.PLAYWRIGHT_SELLER_PASSWORD;
const displayName = process.env.PLAYWRIGHT_SELLER_NAME || "Browser Seller";

function requireEnv(name: string, value?: string) {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function ensureSellerUser() {
  const sellerEmail = requireEnv("PLAYWRIGHT_SELLER_EMAIL", email).toLowerCase();
  const sellerPassword = requireEnv("PLAYWRIGHT_SELLER_PASSWORD", password);
  const passwordHash = await bcrypt.hash(sellerPassword, 12);

  const user = await queryOne<{ id: string }>(
    `INSERT INTO users (
       email,
       display_name,
       password_hash,
       email_verified,
       role,
       subscription_tier
     )
     VALUES ($1, $2, $3, true, 'seller', 'featured')
     ON CONFLICT (email)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       password_hash = EXCLUDED.password_hash,
       email_verified = true,
       role = 'seller',
       subscription_tier = 'featured'
     RETURNING id`,
    [sellerEmail, displayName, passwordHash]
  );

  if (!user) {
    throw new Error("Failed to upsert seller browser test user");
  }

  return user.id;
}

async function ensureSellerListing(userId: string) {
  const existing = await queryOne<{ id: string }>(
    `SELECT id
     FROM boats
     WHERE seller_id = $1
       AND listing_source = 'platform'
       AND source_url IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (existing) {
    return existing.id;
  }

  const slug = `browser-seller-${Date.now()}`;
  const boat = await queryOne<{ id: string }>(
    `INSERT INTO boats (
       seller_id, slug, make, model, year, asking_price, currency,
       status, location_text, listing_source, is_sample
     )
     VALUES ($1, $2, 'OnlyHulls', 'Browser Test 36', 2024, 125000, 'USD',
       'draft', 'Annapolis, MD', 'platform', true)
     RETURNING id`,
    [userId, slug]
  );

  if (!boat) {
    throw new Error("Failed to create seller browser test listing");
  }

  await query(
    `INSERT INTO boat_dna (boat_id, specs, character_tags, condition_score, ai_summary)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (boat_id)
     DO UPDATE SET
       specs = EXCLUDED.specs,
       character_tags = EXCLUDED.character_tags,
       condition_score = EXCLUDED.condition_score,
       ai_summary = EXCLUDED.ai_summary`,
    [
      boat.id,
      JSON.stringify({
        loa: 36,
        beam: 12.2,
        draft: 5.4,
        rig_type: "sloop",
        hull_material: "fiberglass",
        engine: "Yanmar diesel",
        berths: 6,
        heads: 1,
      }),
      ["browser-test", "coastal-cruiser"],
      7,
      "Browser test listing used for authenticated seller smoke coverage.",
    ]
  );

  return boat.id;
}

async function main() {
  const userId = await ensureSellerUser();
  const listingId = await ensureSellerListing(userId);
  console.log(JSON.stringify({ ok: true, userId, listingId }, null, 2));
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
