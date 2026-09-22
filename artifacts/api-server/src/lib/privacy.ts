import { eq, selectRows } from "./supabase";

export type Permission = "everyone" | "friendsOnly" | "onlyMe";

export async function getSettings(userId: number) {
  const [row] = await selectRows("user_settings", { filters: [eq("userId", userId)], limit: 1 });
  return {
    privateAccount: Boolean(row?.privateAccount),
    readReceipts: row?.readReceipts !== false,
    messagePermissions: (row?.messagePermissions ?? row?.messagePermission ?? "everyone") as Permission,
    commentPermissions: (row?.commentPermissions ?? row?.commentPermission ?? "everyone") as Permission,
    storyPermissions: (row?.storyPermissions ?? row?.storyPermission ?? "friendsOnly") as Permission,
    pushNotifications: row?.pushNotifications !== false,
    emailNotifications: row?.emailNotifications !== false,
  };
}

export async function areFriends(a: number, b: number) {
  if (a === b) return true;
  const rows = await selectRows("follows", {
    filters: [eq("followerId", a), eq("followingId", b)],
    limit: 1,
  });
  if (rows.length) return true;
  const reverse = await selectRows("follows", {
    filters: [eq("followerId", b), eq("followingId", a)],
    limit: 1,
  });
  return reverse.length > 0;
}

export async function canInteract(permission: Permission, actorId: number, ownerId: number) {
  if (actorId === ownerId || permission === "everyone") return true;
  if (permission === "onlyMe") return false;
  return areFriends(actorId, ownerId);
}
