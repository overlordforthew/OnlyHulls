import { Resend } from "resend";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { emailEnabled } from "@/lib/capabilities";
import type { SavedSearchAlertCandidate } from "@/lib/saved-searches";
import { getPublicAppUrl } from "@/lib/config/urls";

let smtpTransporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;
let resendClient: Resend | null = null;

function hasConfiguredValue(value?: string | null) {
  return Boolean(value?.trim());
}

function smtpEnabled() {
  return (
    hasConfiguredValue(process.env.SMTP_HOST) &&
    hasConfiguredValue(process.env.SMTP_PORT) &&
    hasConfiguredValue(process.env.SMTP_FROM)
  );
}

function resendEnabled() {
  return (
    hasConfiguredValue(process.env.RESEND_API_KEY) &&
    hasConfiguredValue(process.env.RESEND_FROM_EMAIL)
  );
}

function getResend() {
  if (!emailEnabled()) {
    throw new Error("Email delivery is not configured");
  }
  if (!resendEnabled()) {
    throw new Error("Resend is not configured");
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function getSmtpTransport() {
  if (!emailEnabled()) {
    throw new Error("Email delivery is not configured");
  }
  if (!smtpEnabled()) {
    throw new Error("SMTP is not configured");
  }

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
      host: process.env.SMTP_HOST!,
      port: Number.parseInt(process.env.SMTP_PORT || "25", 10),
      secure,
      auth,
    });
  }

  return smtpTransporter;
}

function getFrom() {
  return (
    process.env.SMTP_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    "OnlyHulls <hello@onlyhulls.com>"
  );
}

async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  if (smtpEnabled()) {
    return getSmtpTransport().sendMail({
      from: getFrom(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
  }

  return getResend().emails.send({
    from: getFrom(),
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(amount: number, currency: string): string {
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

export async function sendVerificationEmail(params: {
  email: string;
  verifyUrl: string;
}) {
  return sendEmail({
    to: params.email,
    subject: "Verify your OnlyHulls email",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0369a1;">Welcome to OnlyHulls</h2>
        <p>Please verify your email address to activate your account.</p>
        <div style="margin: 24px 0;">
          <a href="${esc(params.verifyUrl)}" style="background: #0369a1; color: white; padding: 12px 24px; border-radius: 24px; text-decoration: none; display: inline-block;">Verify Email</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(params: {
  email: string;
  resetUrl: string;
}) {
  return sendEmail({
    to: params.email,
    subject: "Reset your OnlyHulls password",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0369a1;">Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to choose a new one.</p>
        <div style="margin: 24px 0;">
          <a href="${esc(params.resetUrl)}" style="background: #0369a1; color: white; padding: 12px 24px; border-radius: 24px; text-decoration: none; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">This link expires in 1 hour. If you didn't request a password reset, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendSellerNotification(params: {
  sellerEmail: string;
  sellerName: string;
  buyerSummary: string;
  boatTitle: string;
  matchScore: number;
  acceptUrl: string;
  declineUrl: string;
}) {
  return sendEmail({
    to: params.sellerEmail,
    subject: `New Match: Someone is interested in your ${params.boatTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0369a1;">New Buyer Match on OnlyHulls</h2>
        <p>Hi ${esc(params.sellerName || "there")},</p>
        <p>A buyer matched <strong>${Math.round(params.matchScore * 100)}%</strong> with your listing: <strong>${esc(params.boatTitle)}</strong></p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0;">Buyer Profile Summary</h3>
          <p>${esc(params.buyerSummary)}</p>
        </div>
        <p>Would you like to connect with this buyer?</p>
        <div style="margin: 24px 0;">
          <a href="${params.acceptUrl}" style="background: #0369a1; color: white; padding: 12px 24px; border-radius: 24px; text-decoration: none; display: inline-block;">Accept & Connect</a>
          <a href="${params.declineUrl}" style="color: #64748b; padding: 12px 24px; text-decoration: none; display: inline-block;">Decline</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">OnlyHulls — AI-Powered Boat Matchmaking</p>
      </div>
    `,
  });
}

export async function sendIntroductionEmail(params: {
  buyerEmail: string;
  buyerName: string;
  sellerEmail: string;
  sellerName: string;
  boatTitle: string;
  matchScore: number;
}) {
  const emails = [params.buyerEmail, params.sellerEmail];

  return sendEmail({
    to: emails,
    subject: `OnlyHulls Introduction: ${params.boatTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0369a1;">You've Been Connected!</h2>
        <p><strong>${esc(params.buyerName || "A buyer")}</strong> and <strong>${esc(params.sellerName || "a seller")}</strong> have been matched on OnlyHulls.</p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Boat:</strong> ${esc(params.boatTitle)}</p>
          <p><strong>Match Score:</strong> ${Math.round(params.matchScore * 100)}%</p>
        </div>
        <p><strong>Buyer:</strong> ${esc(params.buyerName)} (${esc(params.buyerEmail)})</p>
        <p><strong>Seller:</strong> ${esc(params.sellerName)} (${esc(params.sellerEmail)})</p>
        <p>You're now connected! Reply to this email or reach out directly to start your conversation.</p>
        <p style="color: #94a3b8; font-size: 12px;">OnlyHulls — Be the matchmaker, not the broker.</p>
      </div>
    `,
  });
}

export async function sendSavedSearchAlertEmail(params: {
  email: string;
  displayName: string | null;
  alerts: SavedSearchAlertCandidate[];
}) {
  const appUrl = getPublicAppUrl();
  const firstName = params.displayName?.trim() || "there";
  const totalNewResults = params.alerts.reduce((sum, alert) => sum + alert.newResults, 0);

  const sections = params.alerts
    .map((alert) => {
      const browseUrl = `${appUrl}${alert.browseUrl}`;
      const boats = alert.boats
        .map((boat) => {
          const listingPath = boat.slug || boat.id;
          const listingUrl = `${appUrl}/boats/${listingPath}`;
          const location = boat.locationText ? `<p style="margin: 4px 0 0; color: #64748b;">${esc(boat.locationText)}</p>` : "";

          return `
            <div style="padding: 14px 0; border-top: 1px solid #e2e8f0;">
              <a href="${listingUrl}" style="color: #0f172a; font-weight: 600; text-decoration: none;">${esc(boat.title)}</a>
              <p style="margin: 6px 0 0; color: #0369a1; font-weight: 600;">${esc(formatCurrency(boat.price, boat.currency))}</p>
              ${location}
            </div>
          `;
        })
        .join("");

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

  return sendEmail({
    to: params.email,
    subject: `${totalNewResults} new boat${totalNewResults === 1 ? "" : "s"} match your OnlyHulls alerts`,
    html: `
      <div style="font-family: sans-serif; max-width: 680px; margin: 0 auto; color: #0f172a;">
        <h2 style="color: #0369a1;">New boats for your saved searches</h2>
        <p>Hi ${esc(firstName)},</p>
        <p>We found <strong>${totalNewResults}</strong> new boat${totalNewResults === 1 ? "" : "s"} across <strong>${params.alerts.length}</strong> saved search${params.alerts.length === 1 ? "" : "es"}.</p>
        ${sections}
        <p style="margin-top: 24px; color: #64748b;">
          Manage your alert settings in
          <a href="${appUrl}/account" style="color: #0369a1;">your account</a>.
        </p>
      </div>
    `,
  });
}
