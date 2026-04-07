import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { LOCAL_MEDIA_BASE_PATH } from "@/lib/media";

type AwsS3Module = typeof import("@aws-sdk/client-s3");
type AwsPresignerModule = typeof import("@aws-sdk/s3-request-presigner");
type S3ClientInstance = InstanceType<AwsS3Module["S3Client"]>;

let _s3: S3ClientInstance | null = null;
let _awsS3Module: AwsS3Module | null = null;
let _awsPresignerModule: AwsPresignerModule | null = null;

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

async function loadAwsS3Module(): Promise<AwsS3Module> {
  if (!_awsS3Module) {
    _awsS3Module = await import("@aws-sdk/client-s3");
  }

  return _awsS3Module;
}

async function loadAwsPresignerModule(): Promise<AwsPresignerModule> {
  if (!_awsPresignerModule) {
    _awsPresignerModule = await import("@aws-sdk/s3-request-presigner");
  }

  return _awsPresignerModule;
}

async function getS3(): Promise<S3ClientInstance> {
  if (!_s3) {
    const { S3Client } = await loadAwsS3Module();
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

  const [{ PutObjectCommand }, { getSignedUrl }] = await Promise.all([
    loadAwsS3Module(),
    loadAwsPresignerModule(),
  ]);

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(await getS3(), command, { expiresIn });
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
