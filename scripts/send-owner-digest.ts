import { pool, query, queryOne } from "../src/lib/db";
import { sendOwnerAlertEmail } from "../src/lib/email/resend";
import { getPublicAppUrl } from "../src/lib/config/urls";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";

type SourceHealthRow = {
  source: string;
  active_count: string;
  visible_count: string;
  missing_model_count: string;
  missing_location_count: string;
  missing_image_count: string;
};

type RecentSignupRow = {
  email: string;
  display_name: string | null;
  created_at: string;
};

type RecentBillingEventRow = {
  event_type: "checkout_completed" | "invoice_payment_succeeded" | "invoice_payment_failed";
  email: string | null;
  display_name: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
};

function esc(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseArgValue(name: string, fallback: number) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const raw = process.argv[index + 1];
  const value = Number.parseInt(raw || "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function pct(visible: number, total: number) {
  if (total <= 0) return "0.0%";
  return `${((visible / total) * 100).toFixed(1)}%`;
}

async function getSummary(days: number) {
  return queryOne<{
    signups: string;
    connects: string;
    paid_checkouts: string;
    payment_failures: string;
    listings_submitted: string;
    active_boats: string;
    visible_boats: string;
  }>(
    `SELECT
        (SELECT COUNT(*)::text FROM users WHERE created_at >= NOW() - ($1::text || ' days')::interval) AS signups,
        (SELECT COUNT(*)::text FROM funnel_events WHERE event_type = 'connect_requested' AND created_at >= NOW() - ($1::text || ' days')::interval) AS connects,
        (SELECT COUNT(*)::text FROM funnel_events WHERE event_type = 'checkout_completed' AND created_at >= NOW() - ($1::text || ' days')::interval) AS paid_checkouts,
        (SELECT COUNT(*)::text FROM funnel_events WHERE event_type = 'invoice_payment_failed' AND created_at >= NOW() - ($1::text || ' days')::interval) AS payment_failures,
        (SELECT COUNT(*)::text FROM boats WHERE status = 'pending_review' AND updated_at >= NOW() - ($1::text || ' days')::interval AND listing_source = 'platform' AND source_url IS NULL) AS listings_submitted,
        (SELECT COUNT(*)::text FROM boats WHERE status = 'active') AS active_boats,
        (SELECT COUNT(*)::text FROM boats b WHERE b.status = 'active' AND ${buildVisibleImportQualitySql("b")}) AS visible_boats`,
    [days]
  );
}

async function getRecentSignups(days: number, limit: number) {
  return query<RecentSignupRow>(
    `SELECT email, display_name, created_at
     FROM users
     WHERE created_at >= NOW() - ($1::text || ' days')::interval
       AND email NOT LIKE '%@onlyhulls.test'
       AND email NOT LIKE 'browser-%'
       AND email <> 'system@onlyhulls.com'
     ORDER BY created_at DESC
     LIMIT $2`,
    [days, limit]
  );
}

async function getRecentBillingEvents(days: number, limit: number) {
  return query<RecentBillingEventRow>(
    `SELECT
       fe.event_type,
       u.email,
       u.display_name,
       fe.created_at,
       fe.payload
     FROM funnel_events fe
     LEFT JOIN users u ON u.id = fe.user_id
     WHERE fe.created_at >= NOW() - ($1::text || ' days')::interval
       AND fe.event_type IN ('checkout_completed', 'invoice_payment_succeeded', 'invoice_payment_failed')
     ORDER BY fe.created_at DESC
     LIMIT $2`,
    [days, limit]
  );
}

async function getSourceHealth(limit: number) {
  return query<SourceHealthRow>(
    `SELECT
       COALESCE(b.source_name, 'Platform') AS source,
       COUNT(*)::text AS active_count,
       COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")})::text AS visible_count,
       COUNT(*) FILTER (
         WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_model'
       )::text AS missing_model_count,
       COUNT(*) FILTER (
         WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_location'
       )::text AS missing_location_count,
       COUNT(*) FILTER (
         WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_image'
       )::text AS missing_image_count
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
     GROUP BY COALESCE(b.source_name, 'Platform')
     ORDER BY COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")}) DESC, COUNT(*) DESC
     LIMIT $1`,
    [limit]
  );
}

function renderRecentSignup(signup: RecentSignupRow) {
  const createdAt = new Date(signup.created_at).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `<li><strong>${esc(signup.display_name?.trim() || "Unnamed user")}</strong> - ${esc(signup.email)} <span style="color:#64748b;">(${createdAt} UTC)</span></li>`;
}

function renderRecentBillingEvent(event: RecentBillingEventRow) {
  const createdAt = new Date(event.created_at).toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const person = event.display_name?.trim() || event.email || "Unknown user";
  const currency =
    typeof event.payload?.currency === "string" ? event.payload.currency.toUpperCase() : "USD";
  const amountCents =
    typeof event.payload?.amountPaid === "number"
      ? event.payload.amountPaid
      : typeof event.payload?.amountDue === "number"
        ? event.payload.amountDue
        : null;
  const amountLabel =
    amountCents === null ? "" : ` - ${currency} ${(amountCents / 100).toFixed(2)}`;

  const label =
    event.event_type === "checkout_completed"
      ? "paid start"
      : event.event_type === "invoice_payment_succeeded"
        ? "renewal paid"
        : "payment failed";

  return `<li><strong>${esc(person)}</strong> - ${esc(label)}${esc(amountLabel)} <span style="color:#64748b;">(${createdAt} UTC)</span></li>`;
}

async function main() {
  const days = parseArgValue("--days", 1);
  const sourceLimit = parseArgValue("--limit", 8);
  const signupLimit = parseArgValue("--signup-limit", 8);

  const [summary, recentSignups, recentBillingEvents, sourceHealth] = await Promise.all([
    getSummary(days),
    getRecentSignups(days, signupLimit),
    getRecentBillingEvents(days, signupLimit),
    getSourceHealth(sourceLimit),
  ]);

  const sourceTableRows = sourceHealth
    .map((row) => {
      const active = Number.parseInt(row.active_count, 10);
      const visible = Number.parseInt(row.visible_count, 10);

      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${esc(row.source)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${active}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${visible}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${pct(visible, active)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${row.missing_model_count}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${row.missing_location_count}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${row.missing_image_count}</td>
        </tr>
      `;
    })
    .join("");

  const signupItems = recentSignups.length
    ? `
      <div style="margin-top: 18px;">
        <h3 style="margin-bottom: 10px;">Recent signups</h3>
        <ul style="padding-left: 18px; color: #0f172a;">
          ${recentSignups.map(renderRecentSignup).join("")}
        </ul>
      </div>
    `
    : `<p style="margin-top: 18px; color: #64748b;">No new live signups in the selected window.</p>`;

  const billingItems = recentBillingEvents.length
    ? `
      <div style="margin-top: 18px;">
        <h3 style="margin-bottom: 10px;">Recent billing activity</h3>
        <ul style="padding-left: 18px; color: #0f172a;">
          ${recentBillingEvents.map(renderRecentBillingEvent).join("")}
        </ul>
      </div>
    `
    : `<p style="margin-top: 18px; color: #64748b;">No billing events recorded in the selected window.</p>`;

  const detailsHtml = `
    ${signupItems}
    ${billingItems}
    <div style="margin-top: 24px;">
      <h3 style="margin-bottom: 10px;">Source health snapshot</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="text-align: left; color: #64748b;">
            <th style="padding: 8px; border-bottom: 1px solid #cbd5e1;">Source</th>
            <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">Active</th>
            <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">Visible</th>
            <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">Rate</th>
            <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">Model</th>
            <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">Location</th>
            <th style="padding: 8px; border-bottom: 1px solid #cbd5e1; text-align: right;">Images</th>
          </tr>
        </thead>
        <tbody>${sourceTableRows}</tbody>
      </table>
    </div>
  `;

  await sendOwnerAlertEmail({
    subject: `OnlyHulls daily digest: ${summary?.signups || "0"} signups, ${summary?.connects || "0"} connects, ${summary?.paid_checkouts || "0"} paid starts`,
    title: "OnlyHulls owner digest",
    intro: `Here's the latest snapshot for the last ${days} day${days === 1 ? "" : "s"}.`,
    metadata: [
      { label: "New signups", value: summary?.signups || "0" },
      { label: "Connect requests", value: summary?.connects || "0" },
      { label: "Paid starts", value: summary?.paid_checkouts || "0" },
      { label: "Payment failures", value: summary?.payment_failures || "0" },
      { label: "Listings submitted", value: summary?.listings_submitted || "0" },
      { label: "Active boats", value: summary?.active_boats || "0" },
      { label: "Buyer-visible boats", value: summary?.visible_boats || "0" },
    ],
    detailsHtml,
    ctaUrl: `${getPublicAppUrl()}/admin`,
    ctaLabel: "Open OnlyHulls admin",
  });

  console.log(
    `Owner digest sent (${summary?.signups || "0"} signups, ${summary?.connects || "0"} connects, ${summary?.paid_checkouts || "0"} paid starts, ${summary?.visible_boats || "0"} visible boats).`
  );
}

main()
  .catch((err) => {
    console.error("Owner digest failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
