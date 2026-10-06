import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Search, X, Hash, Globe2, Flame, Clock3, TrendingUp } from "lucide-react";
import { formatCount, type User } from "@/data/mockData";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, apiJson } from "@/lib/api";

type SearchPayload = {
  users?: Array<{ id:number; username:string; displayName:string; avatarUrl:string|null; bio:string; countryFlag:string|null; isFollowing?: boolean }>;
  posts?: Array<Record<string, any>>;
  hashtags?: Array<{tag:string;posts:number;trendScore?:number}>;
};

const SEARCH_CACHE_KEY = "yuniko_search_cache_v3";
const SEARCH_CACHE_TTL = 5 * 60 * 1000;
const searchMemoryCache = new Map<string, { payload: SearchPayload; cachedAt: number }>();

function readSearchCache(key: string) {
  const memory = searchMemoryCache.get(key);
  if (memory) return memory;
  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, { payload: SearchPayload; cachedAt: number }>;
    const entry = parsed[key];
    if (entry) {
      searchMemoryCache.set(key, entry);
      return entry;
    }
  } catch {}
  return null;
}

function writeSearchCache(key: string, payload: SearchPayload) {
  const entry = { payload, cachedAt: Date.now() };
  searchMemoryCache.set(key, entry);
  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    const parsed = raw
      ? JSON.parse(raw) as Record<string, { payload: SearchPayload; cachedAt: number }>
      : {};
    parsed[key] = entry;
    const keys = Object.keys(parsed);
    if (keys.length > 20) {
      const oldest = keys.sort((a, b) => parsed[a].cachedAt - parsed[b].cachedAt)[0];
      if (oldest) delete parsed[oldest];
    }
    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(parsed));
  } catch {}
}

function patchCachedFollowState(key: string, userId: string, following: boolean) {
  const cached = readSearchCache(key);
  if (!cached) return;
  const users = (cached.payload.users ?? []).map((item) =>
    String(item.id) === userId ? { ...item, isFollowing: following } : item,
  );
  writeSearchCache(key, { ...cached.payload, users });
}

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";


type Tab = "forYou" | "people" | "hashtags";

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("forYou");
  const [followStates, setFollowStates] = useState<Record<string, boolean>>({});
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [apiPosts, setApiPosts] = useState<Array<Record<string, any>>>([]);
  const [apiHashtags, setApiHashtags] = useState<Array<{tag:string;posts:number}>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = sessionStorage.getItem("yuniko_recent_searches");
      return raw ? (JSON.parse(raw) as string[]).slice(0, 6) : [];
    } catch {
      return [];
    }
  });

  const toggleFollow = async (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = Number(uid);
    if (!Number.isInteger(id)) return;
    const previous = followStates[uid] ?? apiUsers.find((item) => item.id === uid)?.isFollowing ?? false;
    const optimistic = !previous;
    setFollowStates((prev) => ({ ...prev, [uid]: optimistic }));
    setApiUsers((prev) => prev.map((item) => item.id === uid ? { ...item, isFollowing: optimistic } : item));
    try {
      const result = await apiJson<{ following?: boolean }>(`/users/${id}/follow`, { method: "POST" });
      const following = Boolean(result.following);
      setFollowStates((prev) => ({ ...prev, [uid]: following }));
      setApiUsers((prev) => prev.map((item) => item.id === uid ? { ...item, isFollowing: following } : item));
      patchCachedFollowState(`${Number(user?.id)}:${query.trim().toLowerCase()}`, uid, following);
    } catch {
      setFollowStates((prev) => ({ ...prev, [uid]: previous }));
      setApiUsers((prev) => prev.map((item) => item.id === uid ? { ...item, isFollowing: previous } : item));
    }
  };

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!user) {
      setApiUsers([]);
      setApiPosts([]);
      setApiHashtags([]);
      return;
    }

    if (normalizedQuery.length >= 2) {
      setRecentSearches((previous) => {
        const next = [
          normalizedQuery,
          ...previous.filter((item) => item.toLowerCase() !== normalizedQuery.toLowerCase()),
        ].slice(0, 6);
        try { sessionStorage.setItem("yuniko_recent_searches", JSON.stringify(next)); } catch {}
        return next;
      });
    }

    const cacheKey = `${Number(user.id)}:${normalizedQuery.toLowerCase()}`;
    const cached = readSearchCache(cacheKey);
    const applyPayload = (data: SearchPayload, followingIds?: Set<number>) => {
      setApiPosts(data.posts ?? []);
      setApiHashtags(data.hashtags ?? []);
      setApiUsers((data.users ?? []).map((resultUser) => ({
        id: String(resultUser.id),
        username: resultUser.username,
        displayName: resultUser.displayName,
        avatar: resultUser.avatarUrl ??
          `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(resultUser.displayName)}&backgroundColor=FF006E`,
        bio: resultUser.bio,
        location: "",
        flag: resultUser.countryFlag ?? "",
        verified: false,
        followers: 0,
        following: 0,
        posts: 0,
        isOnline: false,
        coverPhoto: "",
        isFollowing: followingIds ? followingIds.has(Number(resultUser.id)) : Boolean(resultUser.isFollowing),
        isFriend: false,
      })));
    };

    if (cached) {
      applyPayload(cached.payload);
      setIsSearching(false);
      if (Date.now() - cached.cachedAt < SEARCH_CACHE_TTL) return;
    }

    const controller = new AbortController();
    if (!cached) setIsSearching(true);

    Promise.all([
      apiFetch(`/users/search?q=${encodeURIComponent(normalizedQuery)}`, { signal: controller.signal }),
      apiFetch(`/users/${Number(user.id)}/relations?mode=following`, { signal: controller.signal }),
    ])
      .then(async ([searchResponse, relationsResponse]) => {
        if (!searchResponse.ok) throw new Error("Search failed");
        const data = (await searchResponse.json()) as SearchPayload;
        let followingIds: Set<number> | undefined;
        if (relationsResponse.ok) {
          const relationData = (await relationsResponse.json()) as {
            users?: Array<{ id:number }>;
          };
          followingIds = new Set((relationData.users ?? []).map((item) => Number(item.id)));
        }
        const payload: SearchPayload = {
          ...data,
          users: (data.users ?? []).map((resultUser) => ({
            ...resultUser,
            isFollowing: followingIds ? followingIds.has(Number(resultUser.id)) : Boolean(resultUser.isFollowing),
          })),
        };
        writeSearchCache(cacheKey, payload);
        applyPayload(payload, followingIds);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError" && !cached) {
          setApiUsers([]);
          setApiPosts([]);
          setApiHashtags([]);
        }
      })
      .finally(() => setIsSearching(false));

    return () => controller.abort();
  }, [query, user]);

  const filteredUsers = apiUsers;
  const filteredPosts = apiPosts;
  const filteredHashtags = apiHashtags;

  const tabs: { id: Tab; label: string }[] = [
    { id: "forYou", label: t("forYou") },
    { id: "people", label: t("people") },
    { id: "hashtags", label: t("hashtag") },
  ];

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-[#050509] pb-24 text-white">
      <header className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[25px] font-extrabold tracking-[-0.04em]" style={{background:"linear-gradient(135deg,#FF3D9A,#008CFF)",WebkitBackgroundClip:"text",color:"transparent"}}>✦</span>
          <h1 className="text-[30px] font-extrabold tracking-[-0.04em]">Yuniko</h1>
        </div>
        <div className="relative p-[2px] rounded-full" style={{background:"linear-gradient(90deg,#FF1493,#008CFF)",boxShadow:"0 0 20px rgba(255,20,147,.16)"}}>
          <div className="h-12 rounded-full bg-[#09090e] flex items-center gap-3 px-4">
            <Search size={22} className="text-[#C34BFF] shrink-0"/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Madagascar, creators, spots..." className="min-w-0 flex-1 bg-transparent text-white text-[14px] outline-none placeholder:text-white/38" data-testid="input-search"/>
            {query&&<button onClick={()=>setQuery("")} data-testid="btn-clear-search"><X size={17} className="text-white/45"/></button>}
          </div>
        </div>
      </header>

      {!query&&<section className="px-4">
        <h2 className="text-[16px] font-bold mb-3">Categories</h2>
        {recentSearches.length > 0 && (
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-white/65">
              <Clock3 size={14} /> Recent searches
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="shrink-0 rounded-full border border-white/[0.09] bg-white/[0.04] px-3.5 py-2 text-[11px] font-semibold text-white/65"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {["All", ...apiHashtags.slice(0,5).map((item) => item.tag)].map((category,i)=><button key={category} onClick={()=>category!=="All"&&setQuery(category)} className="shrink-0 h-11 px-4 rounded-2xl text-[13px] font-semibold" style={{background:i===0?"linear-gradient(135deg,#FF1493,#008CFF)":"rgba(255,255,255,.045)",border:i===0?"none":"1px solid rgba(255,255,255,.18)",color:i===0?"white":"rgba(255,255,255,.65)",boxShadow:i===0?"0 4px 14px rgba(255,20,147,.2)":"none"}}>{category}</button>)}
        </div>
        <div className="mt-7 mb-4 rounded-[22px] border border-white/[0.07] bg-white/[0.035] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Globe2 size={17} className="text-[#36A3FF]" />
                <h2 className="text-[21px] font-extrabold tracking-tight">Trending worldwide</h2>
              </div>
              <p className="mt-1 text-[11px] text-white/40">What is rising across Yuniko globally</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[#FF1493]/10 px-2.5 py-1 text-[10px] font-bold text-[#FF6DBA]">
              <TrendingUp size={12} /> LIVE
            </div>
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Hot right now</h2>
          <span className="text-[12px] font-bold" style={{color:"#C14BFF"}}>{apiHashtags.length} topics</span>
        </div>
        <div className="grid grid-cols-2 gap-3 pb-5">
          {apiPosts.slice(0,8).map((post,index)=><button key={post.id} onClick={()=>setLocation(`/post/live_${post.id}`)} className="text-left overflow-hidden rounded-[20px] bg-[#101016] border border-white/[0.08] shadow-[0_8px_25px_rgba(0,0,0,.28)]" data-testid={`discover-post-${post.id}`}>
            <div className="relative p-[2px] rounded-[18px]" style={{background:"linear-gradient(135deg,#FF1493,#008CFF)"}}>
              <img src={post.mediaUrl || "https://picsum.photos/seed/yuniko-search-"+post.id+"/600/600"} alt={post.caption || "Yuniko post"} className="w-full aspect-[1.42] object-cover rounded-[16px]"/>
            </div>
            <div className="px-3 py-3">
              <p className="text-[13px] font-bold leading-snug line-clamp-2">{post.caption||"Madagascar discovery"}</p>
              <div className="flex items-center justify-between mt-2 text-[11px] text-white/48">
                <span className="truncate pr-2">📍 {post.location||"Yuniko"}</span>
                <span className="shrink-0">♥ {formatCount(Number(post.likes||0))}</span>
              </div>
            </div>
          </button>)}
        </div>
      </section>}

      {query&&<div className="px-4 pb-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
          {tabs.map(tabItem=><button key={tabItem.id} onClick={()=>setTab(tabItem.id)} className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold" style={{background:tab===tabItem.id?"linear-gradient(135deg,#FF1493,#008CFF)":"rgba(255,255,255,.05)",color:tab===tabItem.id?"white":"rgba(255,255,255,.55)",border:tab===tabItem.id?"none":"1px solid rgba(255,255,255,.1)"}}>{tabItem.label}</button>)}
        </div>
        {(tab === "forYou" || tab === "people") && filteredUsers.length > 0 && (
          <div>
            <p className="text-white/45 text-xs font-bold uppercase tracking-wider mb-2">{t("people")}</p>
            {filteredUsers.map((u) => {
              const isFollowing = followStates[u.id] ?? u.isFollowing;
              return (
                <div key={u.id} className="flex items-center gap-3 py-3 border-b border-white/[0.06]">
                  <button
                    onClick={() => setLocation(`/user/${u.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <img src={u.avatar} alt={u.displayName} className="w-12 h-12 rounded-full object-cover border-2 border-pink-400/50" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{u.displayName}</p>
                      <p className="text-white/45 text-xs truncate">@{u.username}</p>
                    </div>
                  </button>
                  <button
                    onClick={(e) => toggleFollow(u.id, e)}
                    className="px-4 py-2 rounded-full text-xs font-bold"
                    style={{
                      background: isFollowing ? "rgba(255,255,255,.08)" : "linear-gradient(135deg,#FF1493,#008CFF)",
                      border: isFollowing ? "1px solid rgba(255,255,255,.15)" : "none",
                    }}
                  >
                    {isFollowing ? t("following") : t("follow")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {(tab === "forYou" || tab === "hashtags") && filteredPosts.length > 0 && (
          <div className="mt-5">
            <p className="text-white/45 text-xs font-bold uppercase tracking-wider mb-2">Posts</p>
            <div className="space-y-2">
              {filteredPosts.slice(0, 12).map((post) => (
                <button
                  key={post.id}
                  onClick={() => setLocation(`/post/live_${post.id}`)}
                  className="w-full flex items-center gap-3 rounded-2xl p-2.5 text-left bg-white/[0.035] border border-white/[0.06]"
                >
                  <img
                    src={post.mediaUrl || "https://picsum.photos/seed/yuniko-" + post.id + "/160/160"}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm line-clamp-2">{post.caption || "Photo on Yuniko"}</p>
                    <p className="text-white/40 text-xs mt-1 truncate">
                      @{post.author?.username || "yuniko"} · ♥ {formatCount(Number(post.likes || 0))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {(tab === "forYou" || tab === "people") &&
          query.length >= 2 &&
          !isSearching &&
          filteredUsers.length === 0 && (
            <p className="py-10 text-center text-white/40 text-sm">No registered users found.</p>
          )}
        {(tab === "forYou" || tab === "hashtags") && filteredHashtags.length > 0 && (
          <div className="mt-3">
            {filteredHashtags.map((h) => (
              <button
                key={h.tag}
                onClick={() => setLocation(`/hashtag/${h.tag}`)}
                className="w-full flex items-center gap-3 py-3 border-b border-white/[0.06] text-left"
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(255,20,147,.1)",
                    border: "1px solid rgba(255,20,147,.25)",
                  }}
                >
                  <Hash size={18} className="text-[#FF3D9A]" />
                </div>
                <div>
                  <p className="font-bold text-sm">#{h.tag}</p>
                  <p className="text-white/45 text-xs">{formatCount(h.posts)} posts</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {filteredUsers.length===0&&filteredPosts.length===0&&filteredHashtags.length===0&&!isSearching&&query.length>=2&&<div className="py-16 text-center"><div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{background:"rgba(255,20,147,.08)",border:"1px solid rgba(255,20,147,.22)"}}><Search size={27} className="text-[#FF3D9A]"/></div><p className="text-white/40 text-sm mt-4">{t("noResults")}</p></div>}
      </div>}
      <BottomNav />
    </div>
  );
}
