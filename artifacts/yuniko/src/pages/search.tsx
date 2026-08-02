import { useState } from "react";
import { useLocation } from "wouter";
import { Search, TrendingUp, Users, X, Hash, Sparkles } from "lucide-react";
import { users, posts, formatCount } from "@/data/mockData";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

const TRENDING_HASHTAGS = [
  { tag: "sunset", posts: 2400000 },
  { tag: "travel", posts: 18900000 },
  { tag: "art", posts: 9300000 },
  { tag: "photography", posts: 45000000 },
  { tag: "fashion", posts: 12000000 },
  { tag: "nature", posts: 34000000 },
  { tag: "food", posts: 67000000 },
  { tag: "music", posts: 28000000 },
];

type Tab = "forYou" | "people" | "hashtags";

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("forYou");
  const [followStates, setFollowStates] = useState<Record<string, boolean>>({});

  const toggleFollow = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowStates((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  const filteredUsers = query
    ? users.filter(
        (u) =>
          u.displayName.toLowerCase().includes(query.toLowerCase()) ||
          u.username.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const filteredHashtags = query
    ? TRENDING_HASHTAGS.filter((h) => h.tag.toLowerCase().includes(query.toLowerCase()))
    : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: "forYou", label: t("forYou") },
    { id: "people", label: t("people") },
    { id: "hashtags", label: t("hashtag") },
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
                boxShadow: tab === tabItem.id ? "0 2px 10px rgba(255,0,110,0.25)" : "none",
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
          {(tab === "forYou" || tab === "people") && filteredUsers.length > 0 && (
            <div>
              <p className="px-4 pt-4 pb-2 text-white/50 text-xs font-semibold uppercase tracking-wider">{t("people")}</p>
              {filteredUsers.map((user) => {
                const isFollowing = followStates[user.id] ?? user.isFollowing;
                return (
                  <button
                    key={user.id}
                    onClick={() => setLocation(`/user/${user.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                    data-testid={`search-user-${user.id}`}
                  >
                    <img src={user.avatar} alt={user.displayName} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">{user.displayName}</p>
                      <p className="text-white/50 text-xs">@{user.username} · {formatCount(user.followers)} {t("followers")}</p>
                    </div>
                    <button
                      onClick={(e) => toggleFollow(user.id, e)}
                      className="px-4 py-1.5 rounded-full text-xs font-semibold text-white flex-shrink-0"
                      style={{
                        background: isFollowing ? "rgba(255,255,255,0.1)" : GRADIENT,
                        border: isFollowing ? "1px solid rgba(255,255,255,0.15)" : "none",
                        boxShadow: isFollowing ? "none" : "0 2px 8px rgba(255,0,110,0.3)",
                      }}
                    >
                      {isFollowing ? t("following") : t("follow")}
                    </button>
                  </button>
                );
              })}
            </div>
          )}

          {(tab === "forYou" || tab === "hashtags") && filteredHashtags.length > 0 && (
            <div>
              <p className="px-4 pt-4 pb-2 text-white/50 text-xs font-semibold uppercase tracking-wider">{t("hashtag")}</p>
              {filteredHashtags.map((h) => (
                <button
                  key={h.tag}
                  onClick={() => setLocation(`/hashtag/${h.tag}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  data-testid={`search-hashtag-${h.tag}`}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(255,0,110,0.12)", border: "1px solid rgba(255,0,110,0.25)" }}
                  >
                    <Hash size={18} style={{ color: "#FF3D9A" }} />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">#{h.tag}</p>
                    <p className="text-white/50 text-xs">{formatCount(h.posts)} posts</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {filteredUsers.length === 0 && filteredHashtags.length === 0 && (
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
        <div>
          {/* Trending hashtags */}
          <div className="px-4 pt-5 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} style={{ color: "#FF3D9A" }} />
              <h2 className="text-white font-semibold text-sm">{t("trending")}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {TRENDING_HASHTAGS.map((h) => (
                <button
                  key={h.tag}
                  onClick={() => setLocation(`/hashtag/${h.tag}`)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    background: "rgba(255,0,110,0.1)",
                    border: "1px solid rgba(255,0,110,0.2)",
                    color: "#FF3D9A",
                  }}
                  data-testid={`trending-${h.tag}`}
                >
                  #{h.tag}
                </button>
              ))}
            </div>
          </div>

          {/* Suggested creators */}
          <div className="px-4 mt-5 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} style={{ color: "#FF3D9A" }} />
              <h2 className="text-white font-semibold text-sm">Suggested Creators</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
              {users.slice(0, 8).map((user) => (
                <button
                  key={user.id}
                  onClick={() => setLocation(`/user/${user.id}`)}
                  className="flex flex-col items-center gap-2 flex-shrink-0"
                  style={{ minWidth: 68 }}
                  data-testid={`trending-creator-${user.id}`}
                >
                  <div className="w-[62px] h-[62px] rounded-full p-[2px]" style={{ background: GRADIENT }}>
                    <img
                      src={user.avatar}
                      alt={user.displayName}
                      className="w-full h-full rounded-full object-cover"
                      style={{ border: "2px solid #0D0B14" }}
                    />
                  </div>
                  <span className="text-white/70 text-[11px] text-center truncate w-full">{user.displayName}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Discover grid */}
          <div className="px-0.5">
            <p className="px-4 py-2 text-white font-semibold text-sm">{t("discover")}</p>
            <div className="grid grid-cols-3 gap-0.5">
              {posts.slice(0, 12).map((post, i) => (
                <button
                  key={post.id}
                  onClick={() => setLocation(`/post/${post.id}`)}
                  className={`overflow-hidden ${i % 7 === 0 ? "col-span-2 row-span-2" : ""}`}
                  style={{
                    aspectRatio: i % 7 === 0 ? undefined : "1",
                    height: i % 7 === 0 ? 200 : undefined,
                  }}
                  data-testid={`discover-post-${post.id}`}
                >
                  <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
