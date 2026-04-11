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

export const STORAGE_BUCKET = process.env.S3_BUCKET || "onlyhulls-media";
