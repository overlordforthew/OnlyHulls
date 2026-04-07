import { pool } from "../src/lib/db/index.ts";
import { emailEnabled } from "../src/lib/capabilities.ts";
import {
  listSavedSearchAlertCandidates,
  markSavedSearchAlertSent,
  type SavedSearchAlertCandidate,
} from "../src/lib/saved-searches.ts";
import { sendSavedSearchAlertEmail } from "../src/lib/email/resend.ts";

interface AlertGroup {
  email: string;
  displayName: string | null;
  alerts: SavedSearchAlertCandidate[];
}

async function main() {
  if (!emailEnabled()) {
    console.log("Saved search alerts skipped: email delivery is not configured.");
    return;
  }

  const limitPerSearch = Number.parseInt(process.env.SAVED_SEARCH_EMAIL_LIMIT || "5", 10);
  const candidates = await listSavedSearchAlertCandidates(
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
    await sendSavedSearchAlertEmail({
      email: group.email,
      displayName: group.displayName,
      alerts: group.alerts,
    });

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
