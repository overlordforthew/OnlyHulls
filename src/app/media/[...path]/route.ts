import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getStorageBackend } from "@/lib/storage-config";
import { resolveLocalMediaPath } from "@/lib/storage-local";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
};

function getContentType(pathname: string): string {
  const extension = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[extension] || "application/octet-stream";
}

export async function GET(req: Request) {
  if (getStorageBackend() !== "local") {
    return NextResponse.json({ error: "Local media is not enabled." }, { status: 404 });
  }

  try {
    const pathname = new URL(req.url).pathname;
    const relativePath = decodeURIComponent(
      pathname.replace(/^\/media\/?/, "").replace(/^\/+/, "")
    );
    if (!relativePath) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
    const filePath = resolveLocalMediaPath(relativePath);
    const file = await readFile(filePath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": getContentType(relativePath),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    logger.warn({ err, url: req.url }, "Local media read failed");
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}
