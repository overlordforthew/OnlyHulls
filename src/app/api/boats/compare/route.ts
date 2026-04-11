import { NextResponse } from "next/server";
import { z } from "zod";
import { getBoatsByIds } from "@/lib/db/queries";
import { logger } from "@/lib/logger";

const compareSchema = z.object({
  ids: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().uuid()).min(1).max(4)),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = compareSchema.safeParse({
    ids: searchParams.get("ids") || "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compare ids" }, { status: 400 });
  }

  try {
    const boats = await getBoatsByIds(parsed.data.ids);
    return NextResponse.json({ boats });
  } catch (err) {
    logger.error({ err }, "GET /api/boats/compare error");
    return NextResponse.json({ error: "Failed to load boats for compare." }, { status: 500 });
  }
}
