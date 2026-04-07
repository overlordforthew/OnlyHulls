import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolveLocalMediaPath, getStorageBackend } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function getContentType(pathname: string): string {
  const extension = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[extension] || "application/octet-stream";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (getStorageBackend() !== "local") {
    return NextResponse.json({ error: "Local media is not enabled." }, { status: 404 });
  }

  try {
    const { path } = await params;
    const relativePath = path.join("/");
    const filePath = resolveLocalMediaPath(relativePath);
    const file = await readFile(filePath);

    return new NextResponse(file, {
      headers: {
        "Content-Type": getContentType(relativePath),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}
