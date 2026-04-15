import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireUser } from "@/lib/auth";
import { createSavedSearch, listSavedSearches } from "@/lib/saved-searches";
import { trackFunnelEvent } from "@/lib/funnel";

export async function GET() {
  try {
    const user = await requireUser();
    const searches = await listSavedSearches(user.id);
    return NextResponse.json({ searches });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error({ err }, "GET /api/saved-searches error");
    return NextResponse.json(
      { error: "Failed to load saved searches. Please try again." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const result = await createSavedSearch(user.id, body ?? {});

    if (!result.duplicate) {
      await trackFunnelEvent({
        eventType: "saved_search_created",
        userId: user.id,
        payload: {
          search: result.savedSearch.filters.search || null,
          location: result.savedSearch.filters.location || null,
          tag: result.savedSearch.filters.tag || null,
          currency: result.savedSearch.filters.currency,
        },
      });
    }

    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error({ err }, "POST /api/saved-searches error");
    return NextResponse.json(
      { error: "Failed to save search. Please try again." },
      { status: 500 }
    );
  }
}
