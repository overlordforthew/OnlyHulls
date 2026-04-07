import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { pool, query, queryOne } from "../src/lib/db/index";

interface SavedSearchEmailRow {
  id: string;
  user_id: string;
  name: string;
  search_query: string | null;
  tag: string | null;
  min_price: string | null;
  max_price: string | null;
  min_year: number | null;
  max_year: number | null;
  rig_type: string | null;
  hull_type: string | null;
  sort: string;
  dir: string;
  last_checked_at: string;
  email: string;
  display_name: string | null;
  email_alerts: "instant" | "weekly";
}

interface AlertBoat {
  id: string;
  slug: string | null;
  year: number;
  make: string;
  model: string;
  asking_price: number;
  currency: string;
  location_text: string | null;
}

interface AlertCandidate {
  savedSearchId: string;
  userId: string;
  email: string;
  displayName: string | null;
  name: string;
  browseUrl: string;
  newResults: number;
  lastCheckedAt: string;
  boats: AlertBoat[];
}

interface AlertGroup {
  email: string;
  displayName: string | null;
  alerts: AlertCandidate[];
}

const PLACEHOLDER_MARKERS = [
  "placeholder",
  "changeme",
  "example",
  "dummy",
  "test_placeholder",
  "replace-me",
  "replace_me",
  "re_placeholder",
];

function hasConfiguredValue(value?: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;

  const normalized = trimmed.toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function emailEnabled() {
  return (
    hasConfiguredValue(process.env.SMTP_HOST) &&
    hasConfiguredValue(process.env.SMTP_PORT) &&
    hasConfiguredValue(process.env.SMTP_FROM)
  );
}

let smtpTransporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

function getTransport() {
  if (!smtpTransporter) {
    const secure = (process.env.SMTP_SECURE || "").toLowerCase() === "true";
    const auth =
      hasConfiguredValue(process.env.SMTP_USER) && hasConfiguredValue(process.env.SMTP_PASS)
        ? {
            user: process.env.SMTP_USER!,
            pass: process.env.SMTP_PASS!,
          }
        : undefined;

    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "127.0.0.1",
      port: Number.parseInt(process.env.SMTP_PORT || "25", 10),
      secure,
      auth,
    });
  }

  return smtpTransporter;
}

function getFrom() {
  return process.env.SMTP_FROM || "OnlyHulls <overlord.gil.ai@gmail.com>";
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://onlyhulls.com").replace(/\/+$/, "");
}

function esc(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(amount: number, currency: string) {
  const symbolMap: Record<string, string> = {
    USD: "$",
    EUR: "EUR ",
    GBP: "GBP ",
    AUD: "AUD ",
    CAD: "CAD ",
    NZD: "NZD ",
    SEK: "SEK ",
    DKK: "DKK ",
    NOK: "NOK ",
  };

  const symbol = symbolMap[currency] || `${currency} `;
  return `${symbol}${Math.round(amount).toLocaleString("en-US")}`;
}

function buildBrowseUrl(row: SavedSearchEmailRow) {
  const params = new URLSearchParams();

  if (row.search_query) params.set("q", row.search_query);
  if (row.tag) params.set("tag", row.tag);
  if (row.min_price) params.set("minPrice", row.min_price);
  if (row.max_price) params.set("maxPrice", row.max_price);
  if (row.min_year) params.set("minYear", String(row.min_year));
  if (row.max_year) params.set("maxYear", String(row.max_year));
  if (row.rig_type) params.set("rigType", row.rig_type);
  if (row.hull_type) params.set("hullType", row.hull_type);
  params.set("sort", row.sort || "newest");
  params.set("dir", row.dir || "desc");

  const queryString = params.toString();
  return queryString ? `/boats?${queryString}` : "/boats";
}

function buildConditions(row: SavedSearchEmailRow, includeSince: boolean) {
  const conditions: string[] = ["b.status = 'active'"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (row.search_query) {
    conditions.push(
      `LOWER(CONCAT_WS(' ',
        b.make,
        b.model,
        COALESCE(d.ai_summary, ''),
        COALESCE(b.location_text, ''),
        COALESCE(b.source_name, ''),
        COALESCE(b.source_site, ''),
        array_to_string(COALESCE(d.character_tags, '{}'), ' '),
        COALESCE(d.specs->>'rig_type', ''),
        COALESCE(d.specs->>'hull_material', '')
      )) LIKE $${paramIdx++}`
    );
    params.push(`%${row.search_query.toLowerCase()}%`);
  }

  if (row.min_price) {
    conditions.push(`b.asking_price >= $${paramIdx++}`);
    params.push(Number(row.min_price));
  }
  if (row.max_price) {
    conditions.push(`b.asking_price <= $${paramIdx++}`);
    params.push(Number(row.max_price));
  }
  if (row.min_year) {
    conditions.push(`b.year >= $${paramIdx++}`);
    params.push(row.min_year);
  }
  if (row.max_year) {
    conditions.push(`b.year <= $${paramIdx++}`);
    params.push(row.max_year);
  }
  if (row.rig_type) {
    conditions.push(`LOWER(COALESCE(d.specs->>'rig_type', '')) = LOWER($${paramIdx++})`);
    params.push(row.rig_type);
  }
  if (row.hull_type) {
    conditions.push(`LOWER(COALESCE(d.specs->>'hull_material', '')) = LOWER($${paramIdx++})`);
    params.push(row.hull_type);
  }
  if (row.tag) {
    conditions.push(`$${paramIdx++} = ANY(COALESCE(d.character_tags, '{}'))`);
    params.push(row.tag);
  }
  if (includeSince) {
    conditions.push(`b.created_at > $${paramIdx++}`);
    params.push(row.last_checked_at);
  }

  return { conditions, params, nextParamIdx: paramIdx };
}

async function countNewResults(row: SavedSearchEmailRow) {
  const { conditions, params } = buildConditions(row, true);
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM boats b
     LEFT JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${conditions.join(" AND ")}`,
    params
  );

  return Number.parseInt(result?.count || "0", 10);
}

async function listNewBoats(row: SavedSearchEmailRow, limit: number) {
  const { conditions, params, nextParamIdx } = buildConditions(row, true);
  const queryParams = [...params, limit];

  return query<AlertBoat>(
    `SELECT b.id, b.slug, b.year, b.make, b.model, b.asking_price, b.currency, b.location_text
     FROM boats b
     LEFT JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT $${nextParamIdx}`,
    queryParams
  );
}

async function listAlertCandidates(limitPerSearch: number) {
  const rows = await query<SavedSearchEmailRow>(
    `SELECT ss.id, ss.user_id, ss.name, ss.search_query, ss.tag, ss.min_price, ss.max_price,
            ss.min_year, ss.max_year, ss.rig_type, ss.hull_type, ss.sort, ss.dir,
            ss.last_checked_at, u.email, u.display_name, u.email_alerts
     FROM saved_searches ss
     JOIN users u ON u.id = ss.user_id
     WHERE u.email_verified = true
       AND u.email_alerts IN ('instant', 'weekly')
       AND (
         u.email_alerts = 'instant'
         OR ss.last_checked_at <= NOW() - INTERVAL '7 days'
       )
     ORDER BY ss.last_checked_at ASC, ss.created_at ASC`
  );

  const candidates: AlertCandidate[] = [];

  for (const row of rows) {
    const newResults = await countNewResults(row);
    if (newResults < 1) continue;

    candidates.push({
      savedSearchId: row.id,
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      name: row.name,
      browseUrl: buildBrowseUrl(row),
      newResults,
      lastCheckedAt: row.last_checked_at,
      boats: await listNewBoats(row, limitPerSearch),
    });
  }

  return candidates;
}

async function markSavedSearchAlertSent(savedSearchId: string, lastCheckedAt: string) {
  const updated = await queryOne<{ id: string }>(
    `UPDATE saved_searches
     SET last_checked_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND last_checked_at = $2
     RETURNING id`,
    [savedSearchId, lastCheckedAt]
  );

  return Boolean(updated);
}

async function sendSavedSearchAlertEmail(group: AlertGroup) {
  const appUrl = getAppUrl();
  const firstName = group.displayName?.trim() || "there";
  const totalNewResults = group.alerts.reduce((sum, alert) => sum + alert.newResults, 0);

  const sections = group.alerts
    .map((alert) => {
      const boats = alert.boats
        .map((boat) => {
          const listingUrl = `${appUrl}/boats/${boat.slug || boat.id}`;
          const location = boat.location_text
            ? `<p style="margin: 4px 0 0; color: #64748b;">${esc(boat.location_text)}</p>`
            : "";

          return `
            <div style="padding: 14px 0; border-top: 1px solid #e2e8f0;">
              <a href="${listingUrl}" style="color: #0f172a; font-weight: 600; text-decoration: none;">${esc(`${boat.year} ${boat.make} ${boat.model}`)}</a>
              <p style="margin: 6px 0 0; color: #0369a1; font-weight: 600;">${esc(formatCurrency(Number(boat.asking_price), boat.currency))}</p>
              ${location}
            </div>
          `;
        })
        .join("");

      const browseUrl = `${appUrl}${alert.browseUrl}`;
      const remainingCount = Math.max(alert.newResults - alert.boats.length, 0);
      const moreLabel =
        remainingCount > 0
          ? `<p style="margin: 12px 0 0; color: #64748b;">+ ${remainingCount} more new boat${remainingCount === 1 ? "" : "s"} in this search.</p>`
          : "";

      return `
        <div style="margin-top: 28px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 14px; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; gap: 12px; align-items: baseline;">
            <h3 style="margin: 0; color: #0f172a;">${esc(alert.name)}</h3>
            <span style="color: #0369a1; font-weight: 600;">${alert.newResults} new</span>
          </div>
          ${boats}
          ${moreLabel}
          <div style="margin-top: 18px;">
            <a href="${browseUrl}" style="background: #0369a1; color: #ffffff; padding: 10px 18px; border-radius: 999px; text-decoration: none; display: inline-block;">View Search</a>
          </div>
        </div>
      `;
    })
    .join("");

  return getTransport().sendMail({
    from: getFrom(),
    to: group.email,
    subject: `${totalNewResults} new boat${totalNewResults === 1 ? "" : "s"} match your OnlyHulls alerts`,
    html: `
      <div style="font-family: sans-serif; max-width: 680px; margin: 0 auto; color: #0f172a;">
        <h2 style="color: #0369a1;">New boats for your saved searches</h2>
        <p>Hi ${esc(firstName)},</p>
        <p>We found <strong>${totalNewResults}</strong> new boat${totalNewResults === 1 ? "" : "s"} across <strong>${group.alerts.length}</strong> saved search${group.alerts.length === 1 ? "" : "es"}.</p>
        ${sections}
        <p style="margin-top: 24px; color: #64748b;">
          Manage your alert settings in
          <a href="${appUrl}/account" style="color: #0369a1;">your account</a>.
        </p>
      </div>
    `,
  });
}

async function main() {
  if (!emailEnabled()) {
    console.log("Saved search alerts skipped: email delivery is not configured.");
    return;
  }

  const limitPerSearch = Number.parseInt(process.env.SAVED_SEARCH_EMAIL_LIMIT || "5", 10);
  const candidates = await listAlertCandidates(
    Number.isFinite(limitPerSearch) && limitPerSearch > 0 ? limitPerSearch : 5
  );

  if (candidates.length === 0) {
    console.log("Saved search alerts: nothing to send.");
    return;
  }

  const grouped = new Map<string, AlertGroup>();
  for (const candidate of candidates) {
    const existing = grouped.get(candidate.userId);
    if (existing) {
      existing.alerts.push(candidate);
      continue;
    }

    grouped.set(candidate.userId, {
      email: candidate.email,
      displayName: candidate.displayName,
      alerts: [candidate],
    });
  }

  let emailsSent = 0;
  let searchesMarked = 0;

  for (const group of grouped.values()) {
    await sendSavedSearchAlertEmail(group);
    emailsSent += 1;

    for (const alert of group.alerts) {
      const marked = await markSavedSearchAlertSent(alert.savedSearchId, alert.lastCheckedAt);
      if (marked) {
        searchesMarked += 1;
      }
    }
  }

  const totalNewResults = candidates.reduce((sum, candidate) => sum + candidate.newResults, 0);
  console.log(
    `Saved search alerts sent: ${emailsSent} email(s), ${searchesMarked} search(es), ${totalNewResults} new boat(s).`
  );
}

main()
  .catch((err) => {
    console.error("Saved search alerts failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
