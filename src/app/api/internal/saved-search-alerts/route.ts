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

  for (const group of grouped.values()) {
    try {
      await sendSavedSearchAlertEmail({
        email: group.email,
        displayName: group.displayName,
        alerts: group.alerts,
      });
      emailsSent += 1;
      for (const alert of group.alerts) {
        const marked = await markSavedSearchAlertSent(alert.savedSearchId, alert.lastCheckedAt);
        if (marked) searchesMarked += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, userId: group.alerts[0]?.userId }, "saved-search-alert email failed");
      errors.push(msg);
    }
  }

  const newBoats = candidates.reduce((sum, c) => sum + c.newResults, 0);
  logger.info({ emailsSent, searchesMarked, newBoats, errorCount: errors.length }, "saved-search-alerts run");
  // When every attempted send failed, return 5xx so the host cron's
  // `curl --fail` flips the job to error state. Partial failures still
  // return 200 — some emails landed and we don't want to retry the whole
  // batch — but the payload surfaces the counts and sanitized failure
  // count so alerting can detect them.
  const body = {
    emailsSent,
    searchesMarked,
    newBoats,
    failureCount: errors.length,
  };
  const allFailed = grouped.size > 0 && emailsSent === 0 && errors.length > 0;
  return NextResponse.json(body, { status: allFailed ? 500 : 200 });
}
