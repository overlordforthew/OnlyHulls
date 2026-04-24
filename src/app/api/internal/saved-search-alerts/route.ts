import { NextResponse } from "next/server";
import {
  listSavedSearchAlertCandidates,
  markSavedSearchAlertSent,
  type SavedSearchAlertCandidate,
} from "@/lib/saved-searches";
import { sendSavedSearchAlertEmail } from "@/lib/email/resend";
import { emailEnabled } from "@/lib/capabilities";
import { logger } from "@/lib/logger";

// Internal cron endpoint — invoked daily by /etc/cron.d/onlyhulls-saved-search-alerts.
// The Next.js standalone build strips scripts/, so the equivalent
// scripts/send-saved-search-alerts.ts cannot run inside the app container.
// Wrapping the logic in an HTTP endpoint keeps all module imports working.
// Authed by a shared secret in the x-internal-secret header so nothing else
// on the public surface can trigger email delivery.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const expected = process.env.INTERNAL_CRON_SECRET;
  if (!expected || expected.length < 24) {
    return NextResponse.json({ error: "Endpoint disabled (secret unset)." }, { status: 503 });
  }
  const provided = req.headers.get("x-internal-secret");
  if (provided !== expected) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!emailEnabled()) {
    return NextResponse.json({ skipped: "email-not-configured" });
  }

  const url = new URL(req.url);
  const limitParam = Number.parseInt(url.searchParams.get("limit") || "5", 10);
  const limitPerSearch = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 5;

  const candidates = await listSavedSearchAlertCandidates(limitPerSearch);
  if (candidates.length === 0) {
    return NextResponse.json({ emailsSent: 0, searchesMarked: 0, newBoats: 0 });
  }

  const grouped = new Map<string, { email: string; displayName: string | null; alerts: SavedSearchAlertCandidate[] }>();
  for (const candidate of candidates) {
    const existing = grouped.get(candidate.userId);
    if (existing) {
      existing.alerts.push(candidate);
    } else {
      grouped.set(candidate.userId, {
        email: candidate.email,
        displayName: candidate.displayName,
        alerts: [candidate],
      });
    }
  }

  let emailsSent = 0;
  let searchesMarked = 0;
  const errors: string[] = [];

  let markFailures = 0;
  for (const group of grouped.values()) {
    try {
      await sendSavedSearchAlertEmail({
        email: group.email,
        displayName: group.displayName,
        alerts: group.alerts,
      });
      emailsSent += 1;
      for (const alert of group.alerts) {
        try {
          const marked = await markSavedSearchAlertSent(alert.savedSearchId, alert.lastCheckedAt);
          if (marked) {
            searchesMarked += 1;
          } else {
            markFailures += 1;
            logger.warn(
              { savedSearchId: alert.savedSearchId, userId: alert.userId },
              "saved-search-alert mark returned false — watermark not advanced, next run will re-send"
            );
          }
        } catch (err) {
          markFailures += 1;
          logger.error({ err, savedSearchId: alert.savedSearchId }, "saved-search-alert mark threw");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, userId: group.alerts[0]?.userId }, "saved-search-alert email failed");
      errors.push(msg);
    }
  }

  const newBoats = candidates.reduce((sum, c) => sum + c.newResults, 0);
  logger.info(
    { emailsSent, searchesMarked, newBoats, sendFailures: errors.length, markFailures },
    "saved-search-alerts run"
  );
  // Return 5xx when the host cron should flip red. Two distinct failure
  // modes both deserve that:
  //   1. All sends failed (no emails landed).
  //   2. Emails sent but NO watermarks advanced — next run will re-send
  //      the same alerts, which is the exact duplicate-email bug we're
  //      guarding against. Partial mark failure still 200 (monitoring
  //      via markFailures in the body / logs).
  const body = {
    emailsSent,
    searchesMarked,
    newBoats,
    sendFailures: errors.length,
    markFailures,
  };
  const allSendsFailed = grouped.size > 0 && emailsSent === 0 && errors.length > 0;
  const allMarksFailed = emailsSent > 0 && searchesMarked === 0;
  const shouldFail = allSendsFailed || allMarksFailed;
  return NextResponse.json(body, { status: shouldFail ? 500 : 200 });
}
