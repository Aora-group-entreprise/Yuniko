import { useState } from "react";
import { useLocation } from "wouter";
import { Heart, MessageCircle, UserPlus, Reply, AtSign, Tag, Bell } from "lucide-react";
import { notifications, getUserById } from "@/data/mockData";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

export default function Notifications() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState(notifications);
  const [activeTab, setActiveTab] = useState<"all" | "mentions">("all");

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const unreadCount = items.filter((n) => !n.read).length;

  const displayed = activeTab === "mentions"
    ? items.filter((n) => n.type === "mention" || n.type === "tag")
    : items;

  const getIcon = (type: string) => {
    switch (type) {
      case "like": return <Heart size={14} className="text-red-400 fill-red-400" />;
      case "comment": return <MessageCircle size={14} className="text-sky-400" />;
      case "follow": return <UserPlus size={14} style={{ color: "#FF3D9A" }} />;
      case "story_reply": return <Reply size={14} className="text-green-400" />;
      case "mention": return <AtSign size={14} className="text-yellow-400" />;
      case "tag": return <Tag size={14} className="text-orange-400" />;
      default: return <Heart size={14} style={{ color: "#FF3D9A" }} />;
    }
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 pt-4 pb-0"
        style={{
          background: "rgba(13,11,20,0.96)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="notifications-header"
      >
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-white">{t("notifications")}</h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm font-medium"
              style={{ color: "#FF3D9A" }}
              data-testid="btn-mark-all-read"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="flex gap-1 pb-0">
          {(["all", "mentions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-medium rounded-t-lg transition-all"
              style={{
                color: activeTab === tab ? "#FF3D9A" : "rgba(255,255,255,0.4)",
                borderBottom: activeTab === tab ? "2px solid #FF3D9A" : "2px solid transparent",
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

      <div className="px-4 py-2" data-testid="notifications-list">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,0,110,0.1)", border: "1px solid rgba(255,0,110,0.2)" }}
            >
              <Bell size={28} style={{ color: "#FF3D9A" }} />
            </div>
            <p className="text-white/40 text-sm">{t("noNotifications")}</p>
          </div>
        ) : (
          displayed.map((notif) => {
            const user = getUserById(notif.userId);
            if (!user) return null;
            return (
              <button
                key={notif.id}
                onClick={() => {
                  if (notif.postId) setLocation(`/post/${notif.postId}`);
                  else setLocation(`/user/${notif.userId}`);
                }}
                className="w-full flex items-center gap-3 py-3 text-left"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  background: !notif.read ? "rgba(255,0,110,0.03)" : "transparent",
                }}
                data-testid={`notif-${notif.id}`}
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    className="w-11 h-11 rounded-full object-cover"
                    onClick={(e) => { e.stopPropagation(); setLocation(`/user/${user.id}`); }}
                  />
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(13,11,20,0.95)", border: "1.5px solid rgba(255,255,255,0.1)" }}
                  >
                    {getIcon(notif.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-sm leading-snug">
                    <span className="font-semibold">{user.displayName}</span>{" "}
                    {notif.text}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">{notif.timestamp} {t("ago")}</p>
                </div>
                {!notif.read && (
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: GRADIENT }}
                  />
                )}
              </button>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
