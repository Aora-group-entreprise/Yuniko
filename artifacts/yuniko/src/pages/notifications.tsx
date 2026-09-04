import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Heart, MessageCircle, UserPlus, Reply, AtSign, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { subscribeToNotifications } from "@/lib/realtime";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
import { apiJson } from "@/lib/api";

const GRADIENT = "linear-gradient(135deg,#FF006E 0%,#8B00FF 100%)";

type AppNotification = {
  id: number;
  type: "follow" | "like" | "comment" | "mention" | "message" | "story";
  actorId: number;
  actorDisplayName: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export default function Notifications() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "mentions">("all");

  useEffect(() => {
    if (!token) return;
    let active = true;

    const load = async () => {
      try {
        const data = await apiJson<{ notifications: AppNotification[] }>("/notifications");
        if (active) setNotifications(data.notifications || []);
      } catch {
        // Keep the empty state when the API is temporarily unavailable.
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const close = subscribeToNotifications((data) => {
      const incoming = Array.isArray(data) ? data : [data];
      setNotifications((previous) => {
        const merged = [...(incoming as AppNotification[]), ...previous];
        const seen = new Set<number>();
        return merged
          .filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          })
          .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      });
    });

    return () => {
      active = false;
      close();
    };
  }, [token]);

  const markAllRead = async () => {
    if (!token) return;
    try {
      await apiJson("/notifications/read-all", { method: "PATCH" });
      setNotifications((previous) =>
        previous.map((item) => ({
          ...item,
          readAt: item.readAt || new Date().toISOString(),
        })),
      );
    } catch {
      // The server remains the source of truth if this request fails.
    }
  };

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const displayed =
    activeTab === "mentions"
      ? notifications.filter((item) => item.type === "mention")
      : notifications;

  const icon = (type: AppNotification["type"]) => {
    if (type === "like") return <Heart size={14} className="text-red-400 fill-red-400" />;
    if (type === "comment") return <MessageCircle size={14} className="text-sky-400" />;
    if (type === "follow") return <UserPlus size={14} style={{ color: "#FF3D9A" }} />;
    if (type === "story") return <Reply size={14} className="text-green-400" />;
    if (type === "mention") return <AtSign size={14} className="text-yellow-400" />;
    return <Heart size={14} style={{ color: "#FF3D9A" }} />;
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 pt-4 pb-0"
        style={{
          background: "rgba(13,11,20,.96)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-white">{t("notifications")}</h1>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-sm font-medium" style={{ color: "#FF3D9A" }}>
              Mark all read
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {(["all", "mentions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-medium rounded-t-lg"
              style={{
                color: activeTab === tab ? "#FF3D9A" : "rgba(255,255,255,.4)",
                borderBottom:
                  activeTab === tab ? "2px solid #FF3D9A" : "2px solid transparent",
              }}
            >
              {tab === "all" ? "All" : "Mentions"}
              {tab === "all" && unreadCount > 0 && (
                <span
                  className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: GRADIENT }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-white/40">Loading notifications...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(255,0,110,.1)",
                border: "1px solid rgba(255,0,110,.2)",
              }}
            >
              <Bell size={28} style={{ color: "#FF3D9A" }} />
            </div>
            <p className="text-white/40 text-sm">{t("noNotifications")}</p>
          </div>
        ) : (
          displayed.map((item) => (
            <button
              key={item.id}
              onClick={() => setLocation(`/user/${item.actorId}`)}
              className="w-full flex items-center gap-3 py-3 text-left"
              style={{
                borderBottom: "1px solid rgba(255,255,255,.05)",
                background: !item.readAt ? "rgba(255,0,110,.03)" : "transparent",
              }}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={
                    item.actorAvatarUrl ||
                    `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(item.actorDisplayName)}&backgroundColor=FF006E`
                  }
                  alt={item.actorDisplayName}
                  className="w-11 h-11 rounded-full object-cover"
                />
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(13,11,20,.95)",
                    border: "1.5px solid rgba(255,255,255,.1)",
                  }}
                >
                  {icon(item.type)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/90 text-sm leading-snug">
                  <span className="font-semibold">{item.actorDisplayName}</span> {item.message}
                </p>
                <p className="text-white/40 text-xs mt-0.5">
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
              {!item.readAt && (
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: GRADIENT }} />
              )}
            </button>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
}
