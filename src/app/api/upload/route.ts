import { auth } from "@/auth";
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
  const key = generateMediaKey(boatId, filename);
  const uploadUrl = await getPresignedUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl, key });
}
