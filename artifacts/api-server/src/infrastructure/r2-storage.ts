import { createHash, createHmac } from "node:crypto";

const clean = (value: string | undefined) => value?.trim() ?? "";
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();

function config() {
  return {
    accountId: clean(process.env.CLOUDFLARE_R2_ACCOUNT_ID),
    accessKeyId: clean(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID),
    secretAccessKey: clean(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY),
    bucket: clean(process.env.CLOUDFLARE_R2_BUCKET) || "yuniko-media",
    publicBaseUrl: clean(process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL).replace(/\/$/, ""),
  };
}

export function isR2StorageConfigured() {
  const c = config();
  return Boolean(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket);
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function putObject(objectPath: string, bytes: Buffer, contentType: string) {
  const c = config();
  if (!isR2StorageConfigured()) throw new Error("Cloudflare R2 storage is not configured");

  const host = `${c.accountId}.r2.cloudflarestorage.com`;
  const encodedPath = `/${encodeURIComponent(c.bucket)}/${encodePath(objectPath)}`;
  const payloadHash = sha256(bytes);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", encodedPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${c.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}${encodedPath}`, {
    method: "PUT",
    headers: {
      Host: host,
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body: bytes,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudflare R2 upload failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

export async function uploadToR2(input: {
  dataUrl: string;
  userId: number;
  filename: string;
  mimeType: string;
}) {
  const match = input.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error("Invalid media data");

  const bytes = Buffer.from(match[1], "base64");
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "upload";
  const objectPath = `${input.userId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  await putObject(objectPath, bytes, input.mimeType);

  const c = config();
  const url = c.publicBaseUrl ? `${c.publicBaseUrl}/${objectPath.split("/").map(encodeURIComponent).join("/")}` : objectPath;
  return { path: objectPath, bucket: c.bucket, url };
}
