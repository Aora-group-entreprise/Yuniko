const SUPABASE_URL = () => process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const SUPABASE_MEDIA_BUCKET = () => process.env.SUPABASE_MEDIA_BUCKET?.trim() || "media";

export function isSupabaseStorageConfigured() { return Boolean(SUPABASE_URL() && SUPABASE_SERVICE_ROLE_KEY()); }

export async function uploadToSupabaseStorage(input: { dataUrl: string; userId: number; filename: string; mimeType: string; kind: string }) {
  const url = SUPABASE_URL();
  const key = SUPABASE_SERVICE_ROLE_KEY();
  if (!url || !key) throw new Error("Supabase Storage is not configured");
  if (!Number.isSafeInteger(input.userId) || input.userId <= 0) throw new Error("Invalid user id");
  if (!["image", "audio", "video"].includes(input.kind)) throw new Error("Unsupported media kind");
  const match = input.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match || match[1] !== input.mimeType) throw new Error("Invalid media data");
  if (!/^(image|audio|video)\/[a-z0-9.+-]+$/i.test(input.mimeType)) throw new Error("Unsupported media type");

  const encoded = match[2];
  if (!encoded || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("Invalid base64 media");
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length) throw new Error("Empty media file");

  const maxBytes = input.kind === "video" ? 25_000_000 : input.kind === "audio" ? 12_000_000 : 9_000_000;
  if (bytes.length > maxBytes) throw new Error("Media file is too large");

  const rawName = typeof input.filename === "string" ? input.filename : "upload";
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "upload";
  const objectPath = `${input.userId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const bucket = SUPABASE_MEDIA_BUCKET();
  if (!bucket || bucket.length > 100 || !/^[a-zA-Z0-9._-]+$/.test(bucket)) throw new Error("Invalid storage bucket");

  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": input.mimeType, "x-upsert": "false" },
    body: bytes,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return { path: objectPath, bucket, url: `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}` };
}
