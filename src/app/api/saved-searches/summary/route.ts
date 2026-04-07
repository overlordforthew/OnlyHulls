import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireUser } from "@/lib/auth";
import { getSavedSearchSummary } from "@/lib/saved-searches";

export async function GET() {
  try {
    const user = await requireUser();
    const summary = await getSavedSearchSummary(user.id);
    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error({ err }, "GET /api/saved-searches/summary error");
    return NextResponse.json(
      { error: "Failed to load saved search summary. Please try again." },
      { status: 500 }
    );
  }
}
