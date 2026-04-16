import { pool } from "./index";
import type { PoolClient } from "pg";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../logger";

type MigrationMarker = {
  name: string;
  checkSql: string;
};

const MIGRATION_MARKERS: MigrationMarker[] = [
  {
    name: "001_init_extensions.sql",
    checkSql: `
      SELECT
        to_regclass('public.users') IS NOT NULL
        AND to_regtype('public.user_role') IS NOT NULL
        AND to_regtype('public.subscription_tier') IS NOT NULL
        AND to_regtype('public.boat_status') IS NOT NULL
        AND to_regtype('public.listing_source') IS NOT NULL
      AS ok
    `,
  },
  {
    name: "002_buyer_profiles.sql",
    checkSql: `
      SELECT
        to_regclass('public.buyer_profiles') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'buyer_profiles'
            AND column_name = 'dna_embedding'
        )
      AS ok
    `,
  },
  {
    name: "003_boats_dna_media.sql",
    checkSql: `
      SELECT
        to_regclass('public.boats') IS NOT NULL
        AND to_regclass('public.boat_dna') IS NOT NULL
        AND to_regclass('public.boat_media') IS NOT NULL
      AS ok
    `,
  },
  {
    name: "004_matches.sql",
    checkSql: `
      SELECT
        to_regclass('public.matches') IS NOT NULL
        AND to_regclass('public.introductions') IS NOT NULL
        AND to_regclass('public.dreamboard') IS NOT NULL
      AS ok
    `,
  },
  {
    name: "005_ai_conversations.sql",
    checkSql: `
      SELECT
        to_regclass('public.ai_conversations') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'buyer_profiles'
            AND column_name = 'ai_conversation_id'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'boat_dna'
            AND column_name = 'ai_conversation_id'
        )
      AS ok
    `,
  },
  {
    name: "006_auth_password.sql",
    checkSql: `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'password_hash'
      ) AS ok
    `,
  },
  {
    name: "007_email_prefs_listing_date.sql",
    checkSql: `
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'email_alerts'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'newsletter_opt_in'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'boats'
            AND column_name = 'listing_date'
        )
        AND to_regclass('public.outreach_contacts') IS NOT NULL
      AS ok
    `,
  },
  {
    name: "011_email_verification.sql",
    checkSql: `
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'email_verified'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'email_verify_token'
        )
      AS ok
    `,
  },
  {
    name: "012_introduction_token_expiry.sql",
    checkSql: `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'introductions'
          AND column_name = 'expires_at'
      ) AS ok
    `,
  },
  {
    name: "013_password_reset.sql",
    checkSql: `
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'password_reset_token'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'password_reset_expires_at'
        )
      AS ok
    `,
  },
  {
    name: "014_contact_clicks.sql",
    checkSql: `
      SELECT to_regclass('public.contact_clicks') IS NOT NULL AS ok
    `,
  },
  {
    name: "015_local_ai_media.sql",
    checkSql: `
      SELECT
        to_regclass('public.llm_responses') IS NOT NULL
        AND to_regclass('public.match_explanations') IS NOT NULL
      AS ok
    `,
  },
  {
    name: "016_match_ai_signals.sql",
    checkSql: `
      SELECT to_regclass('public.match_ai_signals') IS NOT NULL AS ok
    `,
  },
  {
    name: "017_saved_searches.sql",
    checkSql: `
      SELECT to_regclass('public.saved_searches') IS NOT NULL AS ok
    `,
  },
  {
    name: "018_seller_lead_crm.sql",
    checkSql: `
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'introductions'
            AND column_name = 'seller_stage'
        )
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'introductions'
            AND column_name = 'seller_notes'
        )
      AS ok
    `,
  },
  {
    name: "019_active_import_dedup.sql",
    checkSql: `
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_boats_dedup'
          AND indexdef LIKE '%WHERE ((listing_source = ''imported''::listing_source) AND (status = ''active''::boat_status))%'
      ) AS ok
    `,
  },
  {
    name: "020_funnel_events.sql",
    checkSql: `
      SELECT to_regclass('public.funnel_events') IS NOT NULL AS ok
    `,
  },
  {
    name: "021_saved_search_locations.sql",
    checkSql: `
      SELECT (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'saved_searches'
          AND column_name IN ('location_query', 'currency_code')
      ) = 2 AS ok
    `,
  },
  {
    name: "022_boat_claim_requests.sql",
    checkSql: `
      SELECT
        to_regclass('public.boat_claim_requests') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'boats'
            AND column_name = 'claimed_from_boat_id'
        )
      AS ok
    `,
  },
];

async function reconcileExistingMigrations(
  client: PoolClient,
  appliedSet: Set<string>
) {
  const reconciled: string[] = [];

  for (const marker of MIGRATION_MARKERS) {
    if (appliedSet.has(marker.name)) continue;

    const { rows } = await client.query<{ ok: boolean }>(marker.checkSql);
    if (!rows[0]?.ok) continue;

    await client.query("INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [
      marker.name,
    ]);
    appliedSet.add(marker.name);
    reconciled.push(marker.name);
  }

  if (reconciled.length > 0) {
    logger.info({ reconciled }, "reconciled existing migrations");
  }
}

async function migrate() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get already applied migrations
    const { rows: applied } = await client.query(
      "SELECT name FROM _migrations ORDER BY id"
    );
    const appliedSet = new Set(applied.map((r: { name: string }) => r.name));

    await reconcileExistingMigrations(client, appliedSet);

    // Read migration files
    const migrationsDir = path.join(process.cwd(), "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        logger.debug({ migration: file }, "migration already applied, skipping");
        continue;
      }

      logger.info({ migration: file }, "applying migration");
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${err}`);
      }
    }

    logger.info("all migrations applied");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  logger.fatal({ err }, "migration failed");
  process.exit(1);
});
