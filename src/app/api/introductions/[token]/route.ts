import { queryOne, query } from "@/lib/db";
import { sendIntroductionEmail } from "@/lib/email/resend";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!action || !["accept", "decline"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Find introduction by token
    const tokenColumn = action === "accept" ? "accept_token" : "decline_token";
    const intro = await queryOne<{
      id: string;
      match_id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
      expires_at: string | null;
    }>(
      `SELECT id, match_id, buyer_id, seller_id, status, expires_at
       FROM introductions WHERE ${tokenColumn} = $1`,
      [token]
    );

    if (!intro) {
      return new Response(renderPage("Link Not Found", "This introduction link is invalid or has expired."), {
        status: 404,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (intro.expires_at && new Date(intro.expires_at) < new Date()) {
      return new Response(renderPage("Link Expired", "This introduction link has expired. Please ask the buyer to send a new connection request."), {
        status: 410,
        headers: { "Content-Type": "text/html" },
      });
    }

    if (intro.status !== "pending") {
      return new Response(renderPage("Already Responded", "You've already responded to this introduction."), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (action === "accept") {
      // Atomic update: prevents TOCTOU race (double-accept firing duplicate emails)
      const updated = await queryOne<{ id: string }>(
        "UPDATE introductions SET status = 'accepted', responded_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING id",
        [intro.id]
      );
      if (!updated) {
        return new Response(renderPage("Already Responded", "This introduction was already handled."), {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Get both parties' details
      const buyer = await queryOne<{ email: string; display_name: string | null }>(
        "SELECT email, display_name FROM users WHERE id = $1",
        [intro.buyer_id]
      );
      const seller = await queryOne<{ email: string; display_name: string | null }>(
        "SELECT email, display_name FROM users WHERE id = $1",
        [intro.seller_id]
      );
      const match = await queryOne<{ score: number; boat_id: string }>(
        "SELECT score, boat_id FROM matches WHERE id = $1",
        [intro.match_id]
      );
      const boat = await queryOne<{ make: string; model: string; year: number }>(
        "SELECT make, model, year FROM boats WHERE id = $1",
        [match?.boat_id || ""]
      );

      if (buyer && seller && match && boat) {
        try {
          await sendIntroductionEmail({
            buyerEmail: buyer.email,
            buyerName: buyer.display_name || "",
            sellerEmail: seller.email,
            sellerName: seller.display_name || "",
            boatTitle: `${boat.year} ${boat.make} ${boat.model}`,
            matchScore: match.score,
          });

          await query(
            "UPDATE introductions SET intro_sent_at = NOW() WHERE id = $1",
            [intro.id]
          );
        } catch (err) {
          logger.error({ err }, "Failed to send introduction email");
          // The introduction was accepted — email failure is non-fatal
        }
      }

      return new Response(
        renderPage(
          "Connected!",
          "An introduction email has been sent to both you and the buyer. You can now communicate directly via email."
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Decline — atomic to prevent race
    const declined = await queryOne<{ id: string }>(
      "UPDATE introductions SET status = 'declined', responded_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING id",
      [intro.id]
    );
    if (!declined) {
      return new Response(renderPage("Already Responded", "This introduction was already handled."), {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response(
      renderPage("Declined", "You've declined this introduction. The buyer will not receive your contact information."),
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    logger.error({ err }, "GET /api/introductions/[token] error");
    return new Response(
      renderPage("Something Went Wrong", "An unexpected error occurred. Please try the link again or contact support."),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><title>${esc(title)} | OnlyHulls</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f1f5f9}
.card{background:white;padding:48px;border-radius:16px;text-align:center;max-width:480px;box-shadow:0 4px 6px rgba(0,0,0,.1)}
h1{color:#0369a1}a{color:#0369a1}</style></head>
<body><div class="card"><h1>${esc(title)}</h1><p>${esc(message)}</p><a href="/">Back to OnlyHulls</a></div></body></html>`;
}
