import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { LOCAL_MEDIA_BASE_PATH } from "@/lib/media";

let _s3: S3Client | null = null;

export type StorageBackend = "s3" | "local" | "none";

function hasS3Config(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
  );
}

export function getStorageBackend(): StorageBackend {
  const preferred = (process.env.MEDIA_BACKEND || "").trim().toLowerCase();

  if (preferred === "local") {
    return "local";
  }

  if (preferred === "s3") {
    return hasS3Config() ? "s3" : "none";
  }

  if (hasS3Config()) {
    return "s3";
  }

  return "none";
}

function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env.S3_REGION || "fsn1",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      },
      forcePathStyle: true,
    });
  }
  return _s3;
}

const BUCKET = process.env.S3_BUCKET || "onlyhulls-media";
const LOCAL_MEDIA_ROOT =
  process.env.LOCAL_MEDIA_ROOT ||
  (process.env.NODE_ENV === "production"
    ? "/media-data"
    : path.join(/* turbopackIgnore: true */ process.cwd(), ".media"));

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 600
): Promise<string> {
  if (getStorageBackend() !== "s3") {
    throw new Error("S3 storage is not enabled");
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getS3(), command, { expiresIn });
}

export function getPublicUrl(key: string): string {
  if (getStorageBackend() === "local") {
    return `${LOCAL_MEDIA_BASE_PATH}/${key}`;
  }

  return `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
}

export function resolveLocalMediaPath(key: string): string {
  const normalizedKey = key.replace(/^\/+/, "").replace(/\\/g, "/");
  const root = path.resolve(LOCAL_MEDIA_ROOT);
  const resolved = path.resolve(path.join(root, normalizedKey));

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
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, params.bytes);

  return {
    key,
    publicUrl: getPublicUrl(key),
    contentType: params.contentType,
  };
}
