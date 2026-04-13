import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { LOCAL_MEDIA_BASE_PATH } from "@/lib/media";

function getDefaultLocalMediaRoot() {
  if (process.env.NODE_ENV === "production") {
    return "/media-data";
  }

  // Keep development media under a stable project-relative folder so Turbopack
  // does not trace the whole filesystem while resolving local uploads.
  return path.join(/* turbopackIgnore: true */ process.cwd(), ".local-media");
}

function getLocalMediaRoot() {
  return process.env.LOCAL_MEDIA_ROOT || getDefaultLocalMediaRoot();
}

export function getLocalMediaPublicUrl(key: string): string {
  return `${LOCAL_MEDIA_BASE_PATH}/${key}`;
}

export function resolveLocalMediaPath(key: string): string {
  const normalizedKey = key.replace(/^\/+/, "").replace(/\\/g, "/");
  const root = path.resolve(getLocalMediaRoot());
  const resolved = path.resolve(path.join(/* turbopackIgnore: true */ root, normalizedKey));

  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Invalid media path");
  }

  return resolved;
}

export function generateMediaKey(
  boatId: string,
  filename: string,
  type: "image" | "video" = "image"
): string {
  const ext = filename.split(".").pop() || "jpg";
  const timestamp = Date.now();
  return `boats/${boatId}/${type}s/${timestamp}.${ext}`;
}

export async function storeLocalUpload(params: {
  boatId: string;
  filename: string;
  contentType: string;
  bytes: Buffer;
  type?: "image" | "video";
}) {
  const key = generateMediaKey(params.boatId, params.filename, params.type || "image");
  const filePath = resolveLocalMediaPath(key);
  await mkdir(path.dirname(/* turbopackIgnore: true */ filePath), { recursive: true });
  await writeFile(filePath, params.bytes);

  return {
    key,
    publicUrl: getLocalMediaPublicUrl(key),
    contentType: params.contentType,
  };
}
