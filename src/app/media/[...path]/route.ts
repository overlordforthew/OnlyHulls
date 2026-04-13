import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getStorageBackend } from "@/lib/storage-config";
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

function getLocalMediaRoot() {
  if (process.env.LOCAL_MEDIA_ROOT) {
    return process.env.LOCAL_MEDIA_ROOT;
  }

  if (process.env.NODE_ENV === "production") {
    return "/media-data";
  }

  return null;
}

function normalizeMediaSegments(key: string) {
  const normalizedKey = key.replace(/^\/+/, "").replace(/\\/g, "/");
  const segments = normalizedKey
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("Invalid media path");
  }

  return segments;
}

function resolveRouteLocalMediaPath(key: string) {
  const segments = normalizeMediaSegments(key);
  const configuredRoot = getLocalMediaRoot();

  if (configuredRoot) {
    return path.join(configuredRoot, ...segments);
  }

  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    ".local-media",
    ...segments
  );
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
    const filePath = resolveRouteLocalMediaPath(relativePath);
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
