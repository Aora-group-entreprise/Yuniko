import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
import { LoadingSkeleton } from "@/components/ui/skeleton";

type RelationUser = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  countryFlag: string | null;
  followers: number;
  isFollowing: boolean;
};

export default function Followers({ mode = "followers" }: { mode?: "followers" | "following" }) {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const { user: authUser } = useAuth();
  const userId = params?.userId ?? "me";
  const targetId = userId === "me" ? authUser?.id : Number(userId);
  const [users, setUsers] = useState<RelationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const title = mode === "followers" ? t("followers") : t("following");

  useEffect(() => {
    if (!targetId || !Number.isInteger(Number(targetId))) {
      setUsers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiJson<{ users: RelationUser[] }>(`/users/${targetId}/relations?mode=${mode}`)
      .then((data) => {
        if (!cancelled) setUsers(data.users ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setUsers([]);
          setError(err instanceof Error ? err.message : "Unable to load users");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [targetId, mode]);

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation(userId === "me" ? "/profile" : `/user/${userId}`);
  };

  const toggleFollow = async (id: number) => {
    if (!authUser || id === Number(authUser.id)) return;
    setUsers((current) => current.map((item) => item.id === id ? { ...item, isFollowing: !item.isFollowing } : item));
    try {
      const result = await apiJson<{ following: boolean }>(`/users/${id}/follow`, { method: "POST" });
      setUsers((current) => current.map((item) => item.id === id ? { ...item, isFollowing: result.following } : item));
    } catch {
      setUsers((current) => current.map((item) => item.id === id ? { ...item, isFollowing: !item.isFollowing } : item));
    }
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="followers-header"
      >
        <button onClick={goBack} data-testid="btn-back-followers" aria-label="Back">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{title}</h1>
      </header>

      <div data-testid="followers-list">
        {loading ? (
          <LoadingSkeleton variant="list" />
        ) : error ? (
          <div className="py-16 px-4 text-center text-red-300/80 text-sm">{error}</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-white/35 text-sm">
            {mode === "followers" ? "No followers yet" : "Not following anyone yet"}
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="w-full flex items-center gap-3 px-4 py-3.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              data-testid={`follower-${u.id}`}
            >
              <button
                onClick={() => setLocation(`/user/${u.id}`)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <img
                  src={u.avatarUrl ?? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(u.displayName)}&backgroundColor=FF006E`}
                  alt={u.displayName}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{u.displayName}</p>
                  <p className="text-white/50 text-xs truncate">@{u.username} · {u.followers} {t("followers")}</p>
                </div>
              </button>
              {Number(authUser?.id) !== u.id && (
                <button
                  onClick={() => void toggleFollow(u.id)}
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
              )}
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
