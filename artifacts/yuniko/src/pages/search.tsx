import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, TrendingUp, Users, X, Hash, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

interface SearchUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  followers: number;
}

type Tab = "forYou" | "people";

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("forYou");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [followStates, setFollowStates] = useState<Record<number, boolean>>({});

  // Fetch search results from API
  useEffect(() => {
    if (!query.trim() || !token) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await res.json();
        setResults(data.users || []);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [query, token]);

  const toggleFollow = async (userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;

    const isFollowing = followStates[userId];
    const endpoint = isFollowing ? "delete" : "post";
    const method = isFollowing ? "DELETE" : "POST";

    try {
      await fetch(`/api/users/${userId}/follow`, {
        method,
        headers: { "Authorization": `Bearer ${token}` },
      });
      setFollowStates((prev) => ({ ...prev, [userId]: !isFollowing }));
    } catch (err) {
      console.error("Follow toggle failed", err);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "forYou", label: t("forYou") },
    { id: "people", label: t("people") },
  ];

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-3"
        style={{
          background: "rgba(13,11,20,0.96)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="search-header"
      >
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <Search size={16} className="text-white/40 flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchUsers")}
            className="flex-1 bg-transparent text-white/85 text-sm outline-none placeholder:text-white/30"
            data-testid="input-search"
          />
          {query && (
            <button onClick={() => setQuery("")} data-testid="btn-clear-search">
              <X size={14} className="text-white/40" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex mt-3 gap-2">
          {tabs.map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: tab === tabItem.id ? GRADIENT : "rgba(255,255,255,0.06)",
                color: tab === tabItem.id ? "white" : "rgba(255,255,255,0.5)",
              }}
              data-testid={`search-tab-${tabItem.id}`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
      </header>

      {/* Search results */}
      {query ? (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-white/40">Searching...</p>
            </div>
          ) : results.length > 0 ? (
            <div>
              {results.map((user) => {
                const isFollowing = followStates[user.id] ?? false;
                return (
                  <button
                    key={user.id}
                    onClick={() => setLocation(`/user/${user.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    data-testid={`search-user-${user.id}`}
                  >
                    <img
                      src={user.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.displayName)}&backgroundColor=FF006E`}
                      alt={user.displayName}
                      className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">{user.displayName}</p>
                      <p className="text-white/50 text-xs">@{user.username} · {user.followers} followers</p>
                    </div>
                    <button
                      onClick={(e) => toggleFollow(user.id, e)}
                      className="px-4 py-1.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
                      style={{
                        background: isFollowing ? "rgba(255,255,255,0.1)" : GRADIENT,
                        border: isFollowing ? "1px solid rgba(255,255,255,0.15)" : "none",
                      }}
                    >
                      {isFollowing ? t("following") : t("follow")}
                    </button>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,0,110,0.1)", border: "1px solid rgba(255,0,110,0.2)" }}
              >
                <Search size={28} style={{ color: "#FF3D9A" }} />
              </div>
              <p className="text-white/40 text-sm">{t("noResults")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-white/40 text-sm">Start typing to search users...</p>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
