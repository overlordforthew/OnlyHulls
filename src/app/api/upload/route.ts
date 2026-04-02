import { auth } from "@/auth";
import { queryOne } from "@/lib/db";
import { getPresignedUploadUrl, generateMediaKey } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { z } from "zod";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const uploadSchema = z.object({
  boatId: z.string().uuid(),
  filename: z.string(),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { boatId, filename, contentType } = parsed.data;

  try {
    // Verify the boat belongs to the requesting user
    const boat = await queryOne<{ seller_id: string }>(
      "SELECT seller_id FROM boats WHERE id = $1",
      [boatId]
    );
    if (!boat || boat.seller_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const key = generateMediaKey(boatId, filename);
    const uploadUrl = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({ uploadUrl, key });
  } catch (err) {
    logger.error({ err }, "POST /api/upload error");
    return NextResponse.json(
      { error: "Failed to generate upload URL. Please try again." },
      { status: 500 }
    );
  }
}
