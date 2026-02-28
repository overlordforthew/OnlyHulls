import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || "re_placeholder");
}

function getFrom() {
  return process.env.RESEND_FROM_EMAIL || "OnlyHulls <hello@namibarden.com>";
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
  return getResend().emails.send({
    from: getFrom(),
    to: params.sellerEmail,
    subject: `New Match: Someone is interested in your ${params.boatTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0369a1;">New Buyer Match on OnlyHulls</h2>
        <p>Hi ${params.sellerName || "there"},</p>
        <p>A buyer matched <strong>${Math.round(params.matchScore * 100)}%</strong> with your listing: <strong>${params.boatTitle}</strong></p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0;">Buyer Profile Summary</h3>
          <p>${params.buyerSummary}</p>
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

  return getResend().emails.send({
    from: getFrom(),
    to: emails,
    subject: `OnlyHulls Introduction: ${params.boatTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0369a1;">You've Been Connected!</h2>
        <p><strong>${params.buyerName || "A buyer"}</strong> and <strong>${params.sellerName || "a seller"}</strong> have been matched on OnlyHulls.</p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Boat:</strong> ${params.boatTitle}</p>
          <p><strong>Match Score:</strong> ${Math.round(params.matchScore * 100)}%</p>
        </div>
        <p><strong>Buyer:</strong> ${params.buyerName} (${params.buyerEmail})</p>
        <p><strong>Seller:</strong> ${params.sellerName} (${params.sellerEmail})</p>
        <p>You're now connected! Reply to this email or reach out directly to start your conversation.</p>
        <p style="color: #94a3b8; font-size: 12px;">OnlyHulls — Be the matchmaker, not the broker.</p>
      </div>
    `,
  });
}
