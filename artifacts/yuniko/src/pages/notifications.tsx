import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Heart, MessageCircle, UserPlus, Reply, AtSign, Tag, Bell } from "lucide-react";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
import { apiJson } from "@/lib/api";

const GRADIENT = "linear-gradient(135deg, #FF1493 0%, #8B5CFF 48%, #008CFF 100%)";
const NOTIFICATION_REFRESH_MS = 3000;

interface NotificationItem {
  id: number;
  type: string;
  text: string;
  read: boolean;
  postId: number | null;
  createdAt: string;
  actor: {
    id: number;
    displayName: string;
    avatar: string;
  };
}

function mapNotification(notification: any): NotificationItem {
  return {
    id: Number(notification.id),
    type: String(notification.type ?? ""),
    text: String(notification.text ?? ""),
    read: Boolean(notification.read),
    postId: notification.postId == null ? null : Number(notification.postId),
    createdAt: String(notification.createdAt),
    actor: {
      id: Number(notification.actorId),
      displayName: String(notification.actorDisplayName ?? "Yuniko user"),
      avatar:
        notification.actorAvatarUrl ??
        `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(String(notification.actorDisplayName ?? "Yuniko user"))}&backgroundColor=FF006E`,
    },
  };
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupFor(iso: string): "new" | "today" | "earlier" {
  const created = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - created);
  if (diff < 60 * 60 * 1000) return "new";

  const today = new Date();
  const date = new Date(iso);
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return "today";
  }

  return "earlier";
}

function typeIcon(type: string) {
  switch (type) {
    case "like": return <Heart size={14} fill="currentColor" />;
    case "comment": return <MessageCircle size={14} />;
    case "follow": return <UserPlus size={14} />;
    case "story_reply": return <Reply size={14} />;
    case "mention": return <AtSign size={14} />;
    case "tag": return <Tag size={14} />;
    default: return <Heart size={14} fill="currentColor" />;
  }
}

function typeClass(type: string): string {
  switch (type) {
    case "like": return "text-pink-400";
    case "comment": return "text-sky-400";
    case "follow": return "text-violet-400";
    case "story_reply": return "text-emerald-400";
    case "mention": return "text-amber-300";
    case "tag": return "text-orange-400";
    default: return "text-pink-400";
  }
}

function cleanText(notif: NotificationItem): string {
  if (notif.text) return notif.text;
  switch (notif.type) {
    case "like": return "liked your photo";
    case "comment": return "commented on your post";
    case "follow": return "started following you";
    case "story_reply": return "replied to your story";
    case "mention": return "mentioned you";
    case "tag": return "tagged you";
    default: return "interacted with you";
  }
}

function NotificationCard({
  notif,
  onOpen,
}: {
  notif: NotificationItem;
  onOpen: (notif: NotificationItem) => void;
}) {
  const isFollow = notif.type === "follow";
  const text = cleanText(notif);

  return (
    <button
      type="button"
      onClick={() => onOpen(notif)}
      className="group relative w-full overflow-hidden rounded-[19px] border px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
      style={{
        borderColor: notif.read ? "rgba(255,255,255,0.10)" : "rgba(255,20,147,0.30)",
        background: notif.read
          ? "linear-gradient(120deg,rgba(17,16,24,.94),rgba(9,10,18,.94))"
          : "linear-gradient(120deg,rgba(28,17,31,.96),rgba(10,14,27,.96))",
        boxShadow: notif.read
          ? "0 8px 28px rgba(0,0,0,.24), inset 0 0 24px rgba(0,120,255,.025)"
          : "0 8px 30px rgba(255,20,147,.07), inset 0 0 26px rgba(0,120,255,.04)",
      }}
      data-testid={`notif-${notif.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div
            className="rounded-full p-[3px]"
            style={{ background: GRADIENT, boxShadow: "0 0 14px rgba(255,20,147,.16)" }}
          >
            <div className="rounded-full bg-[#090910] p-[2px]">
              <img
                src={notif.actor.avatar}
                alt={notif.actor.displayName}
                className="h-[58px] w-[58px] rounded-full object-cover"
                onClick={(event) => {
                  event.stopPropagation();
                  window.location.href = `/user/${notif.actor.id}`;
                }}
              />
            </div>
          </div>
          <span
            className={`absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-[10px] border border-white/10 bg-[#17141f] ${typeClass(notif.type)}`}
          >
            {typeIcon(notif.type)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[16px] leading-[1.08] text-white">
            <span className="font-extrabold tracking-[-0.02em]">{notif.actor.displayName}</span>{" "}
            <span className="font-medium text-white/90">{text}</span>
          </p>
          <p className="mt-1 text-[14px] font-medium text-white/48">{relativeTime(notif.createdAt)}</p>
        </div>

        {isFollow ? (
          <span
            className="shrink-0 rounded-[12px] px-4 py-2 text-[15px] font-extrabold text-white"
            style={{ background: GRADIENT, boxShadow: "0 0 18px rgba(117,76,255,.22)" }}
            onClick={(event) => event.stopPropagation()}
          >
            Follow
          </span>
        ) : notif.postId ? (
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]"
            style={{
              background: "linear-gradient(135deg,rgba(255,20,147,.30),rgba(0,140,255,.25))",
              border: "1px solid rgba(255,20,147,.30)",
            }}
          >
            {typeIcon(notif.type)}
          </span>
        ) : !notif.read ? (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: GRADIENT, boxShadow: "0 0 10px rgba(255,20,147,.65)" }}
          />
        ) : null}
      </div>
    </button>
  );
}

export default function Notifications() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let requestInFlight = false;

    const syncNotifications = async (initial = false) => {
      if (!alive || requestInFlight) return;
      requestInFlight = true;

      try {
        const result = await apiJson<{ notifications: Array<any> }>("/notifications");
        if (!alive) return;

        const incoming = (result.notifications ?? []).map(mapNotification);
        setItems((current) => {
          if (current.length === 0) return incoming;

          const previousById = new Map(current.map((item) => [item.id, item]));
          return incoming.map((item) => {
            const previous = previousById.get(item.id);
            return previous && previous.read && !item.read ? { ...item, read: true } : item;
          });
        });
      } catch {
        // Keep the last successful list visible during a temporary network failure.
      } finally {
        requestInFlight = false;
        if (alive && initial) setLoading(false);
      }
    };

    void syncNotifications(true);
    const interval = window.setInterval(() => void syncNotifications(false), NOTIFICATION_REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void syncNotifications(false);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    void apiJson("/notifications/read-all", { method: "PATCH" }).catch(() => undefined);
  };

  const unreadCount = items.filter((item) => !item.read).length;

  const grouped = useMemo(() => {
    const groups: Record<"new" | "today" | "earlier", NotificationItem[]> = {
      new: [],
      today: [],
      earlier: [],
    };
    for (const item of items) groups[groupFor(item.createdAt)].push(item);
    return groups;
  }, [items]);

  const openNotification = (notif: NotificationItem) => {
    if (notif.postId) {
      setLocation(`/post/live_${notif.postId}`);
    } else {
      setLocation(`/user/${notif.actor.id}`);
    }
  };

  const renderGroup = (key: "new" | "today" | "earlier", label: string) => {
    if (!grouped[key].length) return null;

    return (
      <section className="mb-7">
        <div className="mb-3 flex items-center gap-2 px-1">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: GRADIENT, boxShadow: "0 0 10px rgba(255,20,147,.55)" }}
          />
          <h2
            className="text-[22px] font-extrabold tracking-[-0.04em]"
            style={{
              background: GRADIENT,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {label}
          </h2>
        </div>

        <div className="space-y-2.5">
          {grouped[key].map((notif) => (
            <NotificationCard key={notif.id} notif={notif} onOpen={openNotification} />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div
      className="relative mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#050509] text-white"
      data-testid="notifications-page"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -left-32 top-28 h-80 w-80 rounded-full opacity-75 blur-[75px]"
          style={{ background: "rgba(255,0,140,.20)" }}
        />
        <div
          className="absolute -right-36 top-[34%] h-[430px] w-[430px] rounded-full opacity-70 blur-[85px]"
          style={{ background: "rgba(0,130,255,.18)" }}
        />
        <div
          className="absolute -right-20 bottom-10 h-64 w-64 rounded-full opacity-45 blur-[75px]"
          style={{ background: "rgba(160,50,255,.18)" }}
        />
      </div>

      <header className="relative z-10 shrink-0 px-5 pb-3 pt-5">
        <div className="mb-1 flex items-center">
          <span
            className="text-[11px] font-black tracking-[0.08em]"
            style={{
              background: GRADIENT,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ✦ YUNIKO
          </span>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-[42px] font-black tracking-[-0.055em] text-white">Notifications</h1>

          <button
            type="button"
            onClick={markAllRead}
            aria-label={unreadCount ? "Mark all notifications as read" : "Notifications"}
            className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "rgba(18,15,28,.72)",
              boxShadow: "0 0 26px rgba(123,70,255,.28)",
            }}
          >
            <Bell
              size={32}
              strokeWidth={1.8}
              style={{ color: "#C86BFF", filter: "drop-shadow(0 0 8px rgba(255,20,147,.8))" }}
            />
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: "linear-gradient(135deg,rgba(255,20,147,.22),rgba(0,140,255,.18))",
                maskImage: "linear-gradient(#000,transparent)",
                WebkitMaskImage: "linear-gradient(#000,transparent)",
              }}
            />
          </button>
        </div>
      </header>

      <main
        className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 pb-28 pt-1"
        data-testid="notifications-list"
      >
        {loading ? (
          <div className="space-y-2.5 pt-3">
            {[1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="h-[88px] animate-pulse rounded-[19px] border border-white/10 bg-white/[0.035]"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: "rgba(255,20,147,.08)",
                border: "1px solid rgba(255,20,147,.22)",
                boxShadow: "0 0 35px rgba(0,140,255,.10)",
              }}
            >
              <Bell size={34} style={{ color: "#C86BFF" }} />
            </div>
            <p className="text-sm font-medium text-white/40">{t("noNotifications")}</p>
          </div>
        ) : (
          <>
            {renderGroup("new", "New")}
            {renderGroup("today", "Today")}
            {renderGroup("earlier", "Earlier")}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
