import { requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { acknowledgeSavedSearch, deleteSavedSearch } from "@/lib/saved-searches";
import { NextResponse } from "next/server";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const savedSearch = await acknowledgeSavedSearch(user.id, id);

    if (!savedSearch) {
      return NextResponse.json({ error: "Saved search not found" }, { status: 404 });
    }

    return NextResponse.json({ savedSearch });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error({ err }, "PATCH /api/saved-searches/[id] error");
    return NextResponse.json(
      { error: "Failed to update saved search. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const deletedId = await deleteSavedSearch(user.id, id);

    if (!deletedId) {
      return NextResponse.json({ error: "Saved search not found" }, { status: 404 });
    }

    return NextResponse.json({ id: deletedId });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error({ err }, "DELETE /api/saved-searches/[id] error");
    return NextResponse.json(
      { error: "Failed to delete saved search. Please try again." },
      { status: 500 }
    );
  }
}
