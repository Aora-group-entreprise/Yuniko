import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search, UserPlus, Globe, ChevronDown, Bookmark, Share2,
  Flag, EyeOff, WifiOff, Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type Post } from "@/types/domain";
import StoryAvatar from "@/components/StoryAvatar";
import PostCard, { type LiveAuthor } from "@/components/PostCard";
import BottomNav from "@/components/BottomNav";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

const HEADER_H = 56;
const STORIES_H = 78;
const NAV_H = 64;
const TOP_OFFSET = HEADER_H + STORIES_H;

const SCROLL_KEY = "yuniko_feed_scroll";
const POLL_INTERVAL = 30_000; // 30 s

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return isOnline;
}

interface LiveFeedPost {
  post: Post;
  author: LiveAuthor;
}

interface LiveStory {
  id: number;
  userId: number;
  mediaUrl: string;
  caption: string;
  authorDisplayName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const [optionsPostId, setOptionsPostId] = useState<string | null>(null);
  const [worldFeedOpen, setWorldFeedOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [livePosts, setLivePosts] = useState<LiveFeedPost[]>([]);
  const [liveStories, setLiveStories] = useState<LiveStory[]>([]);
  const [newPostsBadge, setNewPostsBadge] = useState(0);

  const selectedPostId = optionsPostId?.startsWith("live_") ? Number(optionsPostId.slice(5)) : NaN;
  const closeOptions = () => setOptionsPostId(null);
  const saveSelectedPost = async () => { if (!Number.isFinite(selectedPostId)) return closeOptions(); await apiFetch(`/posts/${selectedPostId}/save`, { method: "POST" }).catch(() => {}); closeOptions(); };
  const shareSelectedPost = async () => { if (!optionsPostId || !Number.isFinite(selectedPostId)) return closeOptions(); const url = `${window.location.origin}/post/${selectedPostId}`; if (navigator.share) await navigator.share({ title: "Yuniko post", url }).catch(() => undefined); else await navigator.clipboard?.writeText(url).catch(() => undefined); await apiFetch(`/posts/${selectedPostId}/share`, { method: "POST" }).catch(() => {}); closeOptions(); };
  const reportSelectedPost = async () => { if (!Number.isFinite(selectedPostId)) return closeOptions(); await apiFetch(`/posts/${selectedPostId}/report`, { method: "POST" }).catch(() => {}); closeOptions(); };
  const hideSelectedPost = () => { if (optionsPostId) setLivePosts(prev => prev.filter(x => x.post.id !== optionsPostId)); closeOptions(); };

  const fetchFeed = useCallback(
    async (isBackground = false) => {
      if (!token) return;
      try {
        const res = await fetch("/api/posts/feed", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const d = (await res.json()) as { posts?: any[] };
        if (!d.posts) return;

        const converted: LiveFeedPost[] = d.posts.map((p) => ({
          post: {
            id: `live_${p.id}`,
            userId: `live_${p.userId}`,
            imageUrl: p.mediaUrl ?? "",
            mediaType: p.mediaType ?? "text",
            mediaItems: p.mediaItems ? JSON.parse(p.mediaItems) : undefined,
            caption: p.caption ?? "",
            hashtags: p.hashtags ? p.hashtags.split(/[\s,]+/).filter(Boolean) : [],
            likes: p.likes ?? 0,
            comments: p.comments ?? 0,
            shares: p.shares ?? 0,
            saves: p.saves ?? 0,
            timestamp: relativeTime(p.createdAt),
            isLiked: Boolean(p.liked),
            isSaved: Boolean(p.saved),
            location: p.location ?? undefined,
          } satisfies Post,
          author: {
            displayName: p.authorDisplayName,
            username: p.authorUsername,
            avatarUrl: p.authorAvatarUrl,
          },
        }));

        if (isBackground) {
          setLivePosts((prev) => {
            const prevIds = new Set(prev.map((x) => x.post.id));
            const newCount = converted.filter((x) => !prevIds.has(x.post.id)).length;
            if (newCount > 0) setNewPostsBadge((b) => b + newCount);
            return prev;
          });
        } else {
          setLivePosts(converted);
          setNewPostsBadge(0);
        }
      } catch {
        /* keep current feed */
      }
    },
    [token],
  );

  const fetchStories = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/stories", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const d = (await res.json()) as { stories?: any[] };
      if (d.stories) setLiveStories(d.stories);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    fetchFeed(false);
    fetchStories();
  }, [fetchFeed, fetchStories]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchFeed(true);
      fetchStories();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchFeed, fetchStories]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchFeed(false);
        fetchStories();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchFeed, fetchStories]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      const top = parseInt(saved, 10);
      if (!isNaN(top) && top > 0) {
        requestAnimationFrame(() => {
          el.scrollTo({ top, behavior: "instant" });
        });
      }
    }
    const save = () => {
      sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop));
    };
    el.addEventListener("scroll", save, { passive: true });
    return () => el.removeEventListener("scroll", save);
  }, [livePosts.length]);

  const allFeedItems: Array<{ post: Post; author?: LiveAuthor }> = livePosts.map(({ post, author }) => ({ post, author }));

  const handleNewPostsBanner = () => {
    fetchFeed(false);
    fetchStories();
    setNewPostsBadge(0);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    sessionStorage.setItem(SCROLL_KEY, "0");
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto" style={{ height: "100dvh", overflow: "hidden" }}>
      <header className="absolute inset-x-0 top-0 z-50 flex items-center justify-between px-4" style={{ height: HEADER_H, background: "rgba(10,8,18,0.88)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,61,154,0.1)" }} data-testid="home-header">
        <button onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="text-2xl font-black tracking-tight" style={{ background: "linear-gradient(90deg, #FF3D9A 0%, #C026D3 50%, #8B00FF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Yuniko</span>
        </button>
        <button onClick={() => setWorldFeedOpen((p) => !p)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,61,154,0.3)", boxShadow: "0 0 10px rgba(255,0,110,0.1)" }} data-testid="btn-world-feed">
          <Globe size={13} style={{ color: "#FF3D9A" }} />
          <span className="text-white/90 text-sm font-medium">{t("worldFeed")}</span>
          <ChevronDown size={12} className="text-white/55" />
        </button>
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => setLocation("/search")}><Search size={21} className="text-white/75" strokeWidth={1.8} /></motion.button>
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => setLocation("/add-friends")}><UserPlus size={21} className="text-white/75" strokeWidth={1.8} /></motion.button>
        </div>
      </header>

      <AnimatePresence>
        {worldFeedOpen && (
          <>
            <motion.div key="wf-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40" onClick={() => setWorldFeedOpen(false)} />
            <motion.div key="wf-menu" initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }} transition={{ duration: 0.18 }} className="absolute top-[60px] left-1/2 -translate-x-1/2 w-44 rounded-2xl z-50 overflow-hidden" style={{ background: "rgba(18,14,30,0.98)", border: "1px solid rgba(255,61,154,0.25)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              <button onClick={() => setWorldFeedOpen(false)} className="w-full px-4 py-3 text-left text-white/85 text-sm hover:bg-pink-500/15 flex items-center gap-2"><Globe size={13} style={{ color: "#FF3D9A" }} />World Feed</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-0 z-40" style={{ top: HEADER_H, height: STORIES_H, background: "rgba(10,8,18,0.82)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }} data-testid="stories-row">
        <div className="flex items-center gap-3 h-full px-4 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
          <StoryAvatar userId="me" isOwn />
          <button onClick={() => setLocation("/live")} className="flex-shrink-0 flex flex-col items-center gap-1.5" data-testid="btn-go-live-stories">
            <div className="w-14 h-14 rounded-full flex items-center justify-center relative" style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 16px rgba(255,0,110,0.45)" }}>
              <Radio size={22} className="text-white" />
              <div className="absolute -top-0.5 -right-0.5 px-1 py-0.5 rounded-full text-[8px] font-bold text-white leading-none" style={{ background: "#FF006E" }}>LIVE</div>
            </div>
            <span className="text-white/60 text-[10px] font-medium">Go Live</span>
          </button>
          {liveStories.map((story) => <LiveStoryAvatar key={`ls_${story.id}`} story={story} />)}
        </div>
      </div>

      <AnimatePresence>
        {newPostsBadge > 0 && (
          <motion.button key="new-posts-badge" initial={{ opacity: 0, y: -8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.9 }} onClick={handleNewPostsBanner} className="absolute z-50 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-white text-xs font-semibold flex items-center gap-2" style={{ top: TOP_OFFSET + 10, background: "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)", boxShadow: "0 4px 20px rgba(255,0,110,0.5)" }}>↑ {newPostsBadge} new post{newPostsBadge > 1 ? "s" : ""}</motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOnline && (
          <motion.div key="offline-banner" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute inset-x-0 z-30 flex items-center justify-center gap-1.5 py-1.5" style={{ top: TOP_OFFSET, background: "rgba(239,68,68,0.88)", backdropFilter: "blur(8px)" }}>
            <WifiOff size={12} className="text-white" />
            <span className="text-white text-xs font-medium">Offline — showing cached posts</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={scrollRef} className="absolute inset-x-0 overflow-y-scroll" style={{ top: TOP_OFFSET, bottom: NAV_H, scrollSnapType: "y mandatory", scrollSnapStop: "always", WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }} data-testid="posts-feed">
        {allFeedItems.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center px-8 text-center" data-testid="empty-feed">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 28px rgba(255,0,110,0.35)" }}><Globe size={26} className="text-white" /></div>
            <h2 className="text-white text-xl font-black mb-2">Your world feed is ready</h2>
            <p className="text-white/55 text-sm leading-relaxed mb-5">Follow creators or publish the first Yuniko post from your community. Real posts appear here instantly—no sample content.</p>
            <button onClick={() => setLocation("/create")} className="px-5 py-3 rounded-2xl text-white text-sm font-bold" style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)" }}>Create a post</button>
          </div>
        )}
        {allFeedItems.map(({ post, author }) => (
          <div key={post.id} className="relative px-2.5" style={{ height: `calc(100dvh - ${TOP_OFFSET}px - ${NAV_H}px)`, scrollSnapAlign: "start", scrollSnapStop: "always", paddingBottom: 10, flexShrink: 0 }}>
            <div className="relative w-full h-full rounded-[20px] overflow-hidden" style={{ boxShadow: post.isSponsored ? "0 4px 24px rgba(255,0,110,0.18)" : "0 2px 16px rgba(0,0,0,0.4)" }}>
              <PostCard post={post} liveAuthor={author} onOptions={post.isSponsored ? undefined : () => setOptionsPostId(post.id)} />
            </div>
          </div>
        ))}
      </div>

      <BottomNav />

      <AnimatePresence>
        {optionsPostId && (
          <>
            <motion.div key="options-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/65" onClick={() => setOptionsPostId(null)} />
            <motion.div key="options-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 340 }} className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-2xl overflow-hidden" style={{ background: "rgba(16,12,28,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-10 h-1 rounded-full bg-white/18 mx-auto mt-3 mb-4" />
              <button onClick={saveSelectedPost} className="w-full flex items-center gap-3 px-5 py-4 text-white/85 text-sm font-medium" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}><Bookmark size={18} />{t("savePost")}</button>
              <button onClick={shareSelectedPost} className="w-full flex items-center gap-3 px-5 py-4 text-white/85 text-sm font-medium" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}><Share2 size={18} />{t("sharePost")}</button>
              <button onClick={hideSelectedPost} className="w-full flex items-center gap-3 px-5 py-4 text-white/85 text-sm font-medium" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}><EyeOff size={18} />{t("hide")}</button>
              <button onClick={reportSelectedPost} className="w-full flex items-center gap-3 px-5 py-4 text-red-400 text-sm font-medium" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}><Flag size={18} />{t("report")}</button>
              <button onClick={() => setOptionsPostId(null)} className="w-full py-4 text-white/45 text-sm font-medium">{t("cancel")}</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function LiveStoryAvatar({ story }: { story: LiveStory }) {
  const [, setLocation] = useLocation();
  const avatarSrc = story.authorAvatarUrl ?? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(story.authorDisplayName)}&backgroundColor=FF006E`;
  return (
    <motion.button onClick={() => setLocation(`/story/live_${story.id}`)} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 64 }} whileTap={{ scale: 0.9 }}>
      <div className="relative">
        <div className="w-[54px] h-[54px] rounded-full p-[2px]" style={{ background: "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)", boxShadow: "0 0 10px rgba(255,0,110,0.35)" }}>
          <img src={avatarSrc} alt={story.authorDisplayName} className="w-full h-full rounded-full object-cover" style={{ border: "2px solid #0D0B14" }} loading="lazy" />
        </div>
      </div>
      <span className="text-white/70 text-[10px] font-medium leading-tight text-center truncate max-w-[60px]">{story.authorDisplayName}</span>
    </motion.button>
  );
}
