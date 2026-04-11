import { mkdir, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { LOCAL_MEDIA_BASE_PATH } from "@/lib/media";

const LOCAL_MEDIA_ROOT =
  process.env.LOCAL_MEDIA_ROOT ||
  (process.env.NODE_ENV === "production"
    ? "/media-data"
    : path.join(/* turbopackIgnore: true */ os.tmpdir(), "onlyhulls-media"));

export function getLocalMediaPublicUrl(key: string): string {
  return `${LOCAL_MEDIA_BASE_PATH}/${key}`;
}

export function resolveLocalMediaPath(key: string): string {
  const normalizedKey = key.replace(/^\/+/, "").replace(/\\/g, "/");
  const root = path.resolve(/* turbopackIgnore: true */ LOCAL_MEDIA_ROOT);
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
