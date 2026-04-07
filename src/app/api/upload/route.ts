import { auth } from "@/auth";
import { queryOne } from "@/lib/db";
import {
  getPresignedUploadUrl,
  generateMediaKey,
  getPublicUrl,
  getStorageBackend,
  storeLocalUpload,
} from "@/lib/storage";
import { logger } from "@/lib/logger";
import { storageEnabled } from "@/lib/capabilities";
import { NextResponse } from "next/server";
import { z } from "zod";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
const MAX_LOCAL_UPLOAD_BYTES = 8 * 1024 * 1024;

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
  if (!storageEnabled()) {
    return NextResponse.json(
      { error: "Media storage is not configured yet." },
      { status: 503 }
    );
  }

  const backend = getStorageBackend();

  if (backend === "local") {
    try {
      const form = await req.formData();
      const boatId = String(form.get("boatId") || "");
      const file = form.get("file");

      if (!boatId || !(file instanceof File)) {
        return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
        return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
      }
      if (file.size > MAX_LOCAL_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "Each image must be 8 MB or smaller." },
          { status: 400 }
        );
      }

      const boat = await queryOne<{ seller_id: string }>(
        "SELECT seller_id FROM boats WHERE id = $1",
        [boatId]
      );
      if (!boat || boat.seller_id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const uploaded = await storeLocalUpload({
        boatId,
        filename: file.name,
        contentType: file.type,
        bytes,
        type: "image",
      });

      return NextResponse.json({ key: uploaded.key, publicUrl: uploaded.publicUrl });
    } catch (err) {
      logger.error({ err }, "POST /api/upload local storage error");
      return NextResponse.json(
        { error: "Failed to upload image. Please try again." },
        { status: 500 }
      );
    }
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
    const publicUrl = getPublicUrl(key);

    return NextResponse.json({ uploadUrl, key, publicUrl });
  } catch (err) {
    logger.error({ err }, "POST /api/upload error");
    return NextResponse.json(
      { error: "Failed to generate upload URL. Please try again." },
      { status: 500 }
    );
  }
}
