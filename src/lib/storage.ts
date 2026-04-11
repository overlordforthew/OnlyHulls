import {
  generateMediaKey,
  getLocalMediaPublicUrl,
  resolveLocalMediaPath,
  storeLocalUpload,
} from "@/lib/storage-local";
import { getStorageBackend, STORAGE_BUCKET } from "@/lib/storage-config";

type AwsS3Module = typeof import("@aws-sdk/client-s3");
type AwsPresignerModule = typeof import("@aws-sdk/s3-request-presigner");
type S3ClientInstance = InstanceType<AwsS3Module["S3Client"]>;

let _s3: S3ClientInstance | null = null;
let _awsS3Module: AwsS3Module | null = null;
let _awsPresignerModule: AwsPresignerModule | null = null;

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
    Bucket: STORAGE_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(await getS3(), command, { expiresIn });
}

export function getPublicUrl(key: string): string {
  if (getStorageBackend() === "local") {
    return getLocalMediaPublicUrl(key);
  }

  return `${process.env.S3_ENDPOINT}/${STORAGE_BUCKET}/${key}`;
}

export { generateMediaKey, getStorageBackend, resolveLocalMediaPath, storeLocalUpload };
