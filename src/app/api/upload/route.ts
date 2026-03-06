import { auth } from "@/auth";
import { queryOne } from "@/lib/db";
import { getPresignedUploadUrl, generateMediaKey } from "@/lib/storage";
import { NextResponse } from "next/server";
import { z } from "zod";

const uploadSchema = z.object({
  boatId: z.string().uuid(),
  filename: z.string(),
  contentType: z.string().startsWith("image/"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { boatId, filename, contentType } = parsed.data;

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
}
