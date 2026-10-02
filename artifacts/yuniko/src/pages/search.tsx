import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Search, TrendingUp, Users, X, Hash, Sparkles } from "lucide-react";
import { users, posts, formatCount, type User } from "@/data/mockData";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

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
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("forYou");
  const [followStates, setFollowStates] = useState<Record<string, boolean>>({});
  const [apiUsers, setApiUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const toggleFollow = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowStates((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!user || normalizedQuery.length < 2) {
      setApiUsers([]);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    apiFetch(`/users/search?q=${encodeURIComponent(normalizedQuery)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as {
          users?: Array<{
            id: number;
            username: string;
            displayName: string;
            avatarUrl: string | null;
            bio: string;
            countryFlag: string | null;
          }>;
        };
        setApiUsers((data.users ?? []).map((user) => ({
          id: String(user.id),
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatarUrl ??
            `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.displayName)}&backgroundColor=FF006E`,
          bio: user.bio,
          location: "",
          flag: user.countryFlag ?? "",
          verified: false,
          followers: 0,
          following: 0,
          posts: 0,
          isOnline: false,
          coverPhoto: "",
          isFollowing: false,
          isFriend: false,
        })));
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setApiUsers([]);
      })
      .finally(() => setIsSearching(false));

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
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
          {["Baobabs","All","Beaches","Nature","Towns","Adventure"].map((category,i)=><button key={category} onClick={()=>category!=="All"&&setQuery(category)} className="shrink-0 h-11 px-4 rounded-2xl text-[13px] font-semibold" style={{background:i===0?"linear-gradient(135deg,#FF1493,#008CFF)":"rgba(255,255,255,.045)",border:i===0?"none":"1px solid rgba(255,255,255,.18)",color:i===0?"white":"rgba(255,255,255,.65)",boxShadow:i===0?"0 4px 14px rgba(255,20,147,.2)":"none"}}>{category}</button>)}
        </div>

        <div className="flex items-end justify-between mt-7 mb-3">
          <h2 className="text-[21px] font-extrabold tracking-tight">Trending in Madagascar</h2>
          <span className="text-[12px] font-bold" style={{color:"#C14BFF"}}>12.3k trending 🔥</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pb-5">
          {posts.slice(0,8).map(post=><button key={post.id} onClick={()=>setLocation(`/post/${post.id}`)} className="text-left overflow-hidden rounded-[20px] bg-[#101016] border border-white/[0.08] shadow-[0_8px_25px_rgba(0,0,0,.28)]" data-testid={`discover-post-${post.id}`}>
            <div className="relative p-[2px] rounded-[18px]" style={{background:"linear-gradient(135deg,#FF1493,#008CFF)"}}>
              <img src={post.imageUrl} alt={post.caption} className="w-full aspect-[1.42] object-cover rounded-[16px]"/>
            </div>
            <div className="px-3 py-3">
              <p className="text-[13px] font-bold leading-snug line-clamp-2">{post.caption||"Madagascar discovery"}</p>
              <div className="flex items-center justify-between mt-2 text-[11px] text-white/48">
                <span className="truncate pr-2">📍 {post.location||"Madagascar"}</span>
                <span className="shrink-0">♥ {formatCount(post.likes)}</span>
              </div>
            </div>
          </button>)}
        </div>
      </section>}

      {query&&<div className="px-4 pb-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
          {[{id:"forYou",label:t("forYou")},{id:"people",label:t("people")},{id:"hashtags",label:t("hashtag")}].map(tabItem=><button key={tabItem.id} onClick={()=>setTab(tabItem.id as Tab)} className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold" style={{background:tab===tabItem.id?"linear-gradient(135deg,#FF1493,#008CFF)":"rgba(255,255,255,.05)",color:tab===tabItem.id?"white":"rgba(255,255,255,.55)",border:tab===tabItem.id?"none":"1px solid rgba(255,255,255,.1)"}}>{tabItem.label}</button>)}
        </div>
        {(tab==="forYou"||tab==="people")&&filteredUsers.length>0&&<div>
          <p className="text-white/45 text-xs font-bold uppercase tracking-wider mb-2">{t("people")}</p>
          {filteredUsers.map(u=>{const isFollowing=followStates[u.id]??u.isFollowing;return <div key={u.id} className="flex items-center gap-3 py-3 border-b border-white/[0.06]">
            <button onClick={()=>setLocation(`/user/${u.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><img src={u.avatar} alt={u.displayName} className="w-12 h-12 rounded-full object-cover border-2 border-pink-400/50"/><div className="min-w-0"><p className="font-bold text-sm truncate">{u.displayName}</p><p className="text-white/45 text-xs truncate">@{u.username}</p></div></button>
            <button onClick={()=>{setFollowStates(prev=>({...prev,[u.id]:!isFollowing}))}} className="px-4 py-2 rounded-full text-xs font-bold" style={{background:isFollowing?"rgba(255,255,255,.08)":"linear-gradient(135deg,#FF1493,#008CFF)",border:isFollowing?"1px solid rgba(255,255,255,.15)":"none"}}>{isFollowing?t("following"):t("follow")}</button>
          </div>})}
        </div>}
        {(tab==="forYou"||tab==="people")&&query.length>=2&&!isSearching&&filteredUsers.length===0&&<p className="py-10 text-center text-white/40 text-sm">No registered users found.</p>}
        {(tab==="forYou"||tab==="hashtags")&&filteredHashtags.length>0&&<div className="mt-3">{filteredHashtags.map(h=><button key={h.tag} onClick={()=>setLocation(`/hashtag/${h.tag}`)} className="w-full flex items-center gap-3 py-3 border-b border-white/[0.06] text-left"><div className="w-11 h-11 rounded-full flex items-center justify-center" style={{background:"rgba(255,20,147,.1)",border:"1px solid rgba(255,20,147,.25)"}}><Hash size={18} className="text-[#FF3D9A]"/></div><div><p className="font-bold text-sm">#{h.tag}</p><p className="text-white/45 text-xs">{formatCount(h.posts)} posts</p></div></button>)}</div>}
        {filteredUsers.length===0&&filteredHashtags.length===0&&!isSearching&&<div className="py-16 text-center"><div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{background:"rgba(255,20,147,.08)",border:"1px solid rgba(255,20,147,.22)"}}><Search size={27} className="text-[#FF3D9A]"/></div><p className="text-white/40 text-sm mt-4">{t("noResults")}</p></div>}
      </div>}

      <BottomNav />
    </div>
  );
