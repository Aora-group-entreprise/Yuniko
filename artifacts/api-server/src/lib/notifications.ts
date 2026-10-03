import { insertRow } from "./supabase";
import { sendPushToUser } from "./web-push";

type NotificationOptions = {
  postId?: number | null;
  storyId?: number | null;
  url?: string;
  groupKey?: string | null;
};

export async function createNotification(
  recipientId: number,
  actorId: number,
  type: string,
  message: string,
  options: NotificationOptions = {},
) {
  if (!Number.isInteger(recipientId) || recipientId <= 0 || recipientId === actorId) return null;

  const notification = await insertRow("notifications", {
    userId: recipientId,
    actorId,
    type,
    message,
    postId: options.postId ?? null,
    storyId: options.storyId ?? null,
    readAt: null,
    groupKey: options.groupKey ?? null,
    count: 1,
  });

  try {
    await sendPushToUser(recipientId, {
      title: "Yuniko",
      body: message,
      url: options.url ?? "/notifications",
      tag: `notification-${type}`,
    });
  } catch (error) {
    console.error("[YUNIKO NOTIFICATION] push dispatch failed", error);
  }

  return notification;
}
