import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Cloudflare R2 behind presigned URLs (doc 01: files never proxy through the app).
 *  No creds (HANDOFF.md §4) → r2Enabled=false and upload UI hides itself. */
export const r2Enabled = Boolean(
  process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY,
);

const client = r2Enabled
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const BUCKET = process.env.R2_BUCKET ?? "peysich";

/** Key convention: school/{schoolId}/{kind}/{id}.{ext} — tenant-scoped by construction. */
export async function presignUpload(key: string, contentType: string) {
  if (!client) throw new Error("File storage not configured");
  return getSignedUrl(client, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 600 });
}

export async function presignDownload(key: string) {
  if (!client) throw new Error("File storage not configured");
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });
}
