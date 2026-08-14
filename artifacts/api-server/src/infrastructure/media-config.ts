import { getSupabaseConfig } from "./supabase";

/**
 * Media metadata belongs in PostgreSQL; the binary belongs in object storage.
 * This helper keeps API responses consistent without embedding media bytes in
 * database records.
 */
export function getMediaPublicUrl(objectPath: string, bucket?: string) {
  const cleanPath = objectPath.replace(/^\/+/, "");
  const configuredBase = process.env.MEDIA_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (configuredBase) return `${configuredBase}/${cleanPath}`;

  const config = getSupabaseConfig();
  const targetBucket = bucket?.trim() || config.mediaBucket;
  if (!config.url) return "";
  return `${config.url}/storage/v1/object/public/${encodeURIComponent(targetBucket)}/${cleanPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function assertMediaStorageReady() {
  const config = getSupabaseConfig();
  if (!config.url || !config.serviceRoleKey) {
    throw new Error("Supabase Storage is not configured");
  }
}
