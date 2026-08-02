import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, UserX } from "lucide-react";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

const BLOCKED = [
  { id: "b1", username: "annoying_user", avatar: "https://picsum.photos/seed/blocked1/200/200" },
  { id: "b2", username: "spam_account_99", avatar: "https://picsum.photos/seed/blocked2/200/200" },
];

export default function BlockedUsers() {
  const [, setLocation] = useLocation();
  const [blocked, setBlocked] = useState(BLOCKED);

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="blocked-header"
      >
        <button onClick={() => setLocation("/settings")} data-testid="btn-back-blocked">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("blockedUsers")}</h1>
      </header>

      <div className="px-4 py-4">
        <p className="text-white/40 text-sm mb-4">Blocked users cannot see your posts, stories, or contact you.</p>
        {blocked.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <UserX size={40} className="text-white/20" />
            <p className="text-white/40 text-sm">No blocked users</p>
          </div>
        ) : (
          blocked.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              data-testid={`blocked-user-${u.id}`}
            >
              <img src={u.avatar} alt={u.username} className="w-11 h-11 rounded-full object-cover" />
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{u.username}</p>
                <p className="text-white/40 text-xs">@{u.username}</p>
              </div>
              <button
                onClick={() => setBlocked((prev) => prev.filter((b) => b.id !== u.id))}
                className="px-4 py-1.5 rounded-full text-sm font-semibold text-white"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
                data-testid={`btn-unblock-${u.id}`}
              >
                {t("unblock")}
              </button>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
