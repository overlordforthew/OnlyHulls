import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { pool } from "../src/lib/db/index";
import {
  listSavedSearchAlertCandidates,
  markSavedSearchAlertSent,
  type SavedSearchAlertCandidate,
} from "../src/lib/saved-searches";

interface AlertGroup {
  email: string;
  displayName: string | null;
  alerts: SavedSearchAlertCandidate[];
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

async function sendSavedSearchAlertEmail(group: AlertGroup) {
  const appUrl = getAppUrl();
  const firstName = group.displayName?.trim() || "there";
  const totalNewResults = group.alerts.reduce((sum, alert) => sum + alert.newResults, 0);

  const sections = group.alerts
    .map((alert) => {
      const boats = alert.boats
        .map((boat) => {
          const listingUrl = `${appUrl}/boats/${boat.slug || boat.id}`;
          const location = boat.locationText
            ? `<p style="margin: 4px 0 0; color: #64748b;">${esc(boat.locationText)}</p>`
            : "";

          return `
            <div style="padding: 14px 0; border-top: 1px solid #e2e8f0;">
              <a href="${listingUrl}" style="color: #0f172a; font-weight: 600; text-decoration: none;">${esc(boat.title)}</a>
              <p style="margin: 6px 0 0; color: #0369a1; font-weight: 600;">${esc(formatCurrency(Number(boat.price), boat.currency))}</p>
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
