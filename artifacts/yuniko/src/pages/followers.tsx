import { useLocation, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { users, getUserById } from "@/data/mockData";
import { formatCount } from "@/data/mockData";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

export default function Followers({ mode = "followers" }: { mode?: "followers" | "following" }) {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "me";
  const user = userId === "me" ? { displayName: "You" } : getUserById(userId);

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="followers-header"
      >
        <button onClick={() => setLocation(-1 as any)} data-testid="btn-back-followers">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{mode === "followers" ? t("followers") : t("following")}</h1>
      </header>

      <div data-testid="followers-list">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => setLocation(`/user/${u.id}`)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            data-testid={`follower-${u.id}`}
          >
            <img src={u.avatar} alt={u.displayName} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{u.displayName}</p>
              <p className="text-white/50 text-xs">@{u.username} · {formatCount(u.followers)} {t("followers")}</p>
            </div>
            <button
              onClick={(e) => e.stopPropagation()}
              className="px-4 py-1.5 rounded-full text-sm font-semibold text-white flex-shrink-0"
              style={{
                background: u.isFollowing ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)",
                border: u.isFollowing ? "1px solid rgba(255,255,255,0.15)" : "none",
                boxShadow: u.isFollowing ? "none" : "0 2px 8px rgba(255,0,110,0.3)",
              }}
              data-testid={`btn-follow-${u.id}`}
            >
              {u.isFollowing ? t("following") : t("follow")}
            </button>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
