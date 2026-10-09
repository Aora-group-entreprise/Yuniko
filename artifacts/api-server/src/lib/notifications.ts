import { insertRow } from "./supabase";
import { sendPushToUser } from "./web-push";
import { publishRealtimeToUser } from "./realtime";

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
    await publishRealtimeToUser(recipientId, {
      type: "notification:new",
      notification: {
        id: Number(notification.id),
        actorId,
        type,
        message,
        postId: options.postId ?? null,
        storyId: options.storyId ?? null,
        url: options.url ?? "/notifications",
        createdAt: notification.createdAt ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[YUNIKO REALTIME] notification dispatch failed", error);
  }

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
