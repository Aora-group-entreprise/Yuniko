const SUPABASE_URL = () => process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const SUPABASE_MEDIA_BUCKET = () => process.env.SUPABASE_MEDIA_BUCKET?.trim() || "media";

export function isSupabaseStorageConfigured() {
  return Boolean(SUPABASE_URL() && SUPABASE_SERVICE_ROLE_KEY());
}

export async function uploadToSupabaseStorage(input: {
  dataUrl: string;
  userId: number;
  filename: string;
  mimeType: string;
  kind: string;
}) {
  const url = SUPABASE_URL();
  const key = SUPABASE_SERVICE_ROLE_KEY();
  if (!url || !key) throw new Error("Supabase Storage is not configured");

  const match = input.dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) throw new Error("Invalid media data");

  const bytes = Buffer.from(match[1], "base64");
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "upload";
  const objectPath = `${input.userId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const bucket = SUPABASE_MEDIA_BUCKET();

  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": input.mimeType,
      "x-upsert": "false",
    },
    body: bytes,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  return {
    path: objectPath,
    bucket,
    url: `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
  };
}
