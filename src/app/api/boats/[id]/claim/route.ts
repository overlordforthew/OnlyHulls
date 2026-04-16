import { auth } from "@/auth";
import { createClaimDraftForBoat } from "@/lib/claims";
import { getPublicAppUrl } from "@/lib/config/urls";
import { sendOwnerAlertEmail } from "@/lib/email/resend";
import { trackFunnelEvent } from "@/lib/funnel";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: boatId } = await params;

  try {
    const result = await createClaimDraftForBoat({
      boatId,
      claimantUserId: session.user.id,
    });

    if (result.autoUpgradedToSeller) {
      await trackFunnelEvent({
        eventType: "seller_role_selected",
        userId: session.user.id,
        boatId,
        payload: { via: "claim" },
      });
    }

    if (!result.existingDraft) {
      await Promise.all([
        trackFunnelEvent({
          eventType: "listing_claim_requested",
          userId: session.user.id,
          boatId,
          payload: {
            claimId: result.claimId,
            draftBoatId: result.draftBoatId,
            sourceName: result.sourceName,
          },
        }),
        trackFunnelEvent({
          eventType: "seller_listing_created",
          userId: session.user.id,
          boatId: result.draftBoatId,
          payload: { status: "draft", via: "claim" },
        }),
      ]);

      try {
        await sendOwnerAlertEmail({
          subject: `Imported listing claimed: ${result.boatTitle}`,
          title: "Imported listing claimed into a seller draft",
          intro:
            "A seller has claimed an imported listing and a platform draft was created for follow-up.",
          metadata: [
            { label: "Boat", value: result.boatTitle },
            { label: "Source", value: result.sourceName || "Imported listing" },
            { label: "Claim request", value: result.claimId },
            { label: "Draft listing", value: result.draftBoatId },
          ],
          ctaUrl: `${getPublicAppUrl()}/admin`,
          ctaLabel: "Open admin dashboard",
        });
      } catch (err) {
        logger.warn({ err, claimId: result.claimId }, "Failed to send owner claim alert");
      }
    }

    return NextResponse.json({
      success: true,
      claimId: result.claimId,
      draftBoatId: result.draftBoatId,
      draftBoatSlug: result.draftBoatSlug,
      existingDraft: result.existingDraft,
      autoUpgradedToSeller: result.autoUpgradedToSeller,
      redirectTo: `/listings/${result.draftBoatId}?claimed=1&step=review`,
    });
  } catch (err) {
    logger.error({ err, boatId }, "POST /api/boats/[id]/claim error");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to claim listing" },
      { status: 400 }
    );
  }
}
