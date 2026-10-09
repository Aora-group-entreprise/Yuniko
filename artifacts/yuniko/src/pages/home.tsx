import { memo, useState, useEffect, useLayoutEffect, useRef, Fragment as ReactFragment } from "react";
import { useLocation } from "wouter";
import { Bell, UserPlus, Globe, Bookmark, Share2, Flag, EyeOff, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Post } from "@/data/mockData";
import PostCard, { type LiveAuthor } from "@/components/PostCard";
import BottomNav from "@/components/BottomNav";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import ScreenPortal from "@/components/ScreenPortal";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { getSessionCache, setSessionCache, setSessionUser } from "@/lib/session-cache";
import { apiJson } from "@/lib/api";

const NAV_H = "calc(64px + env(safe-area-inset-bottom, 0px))";
const FEED_SCROLL_POSITION_KEY = "yuniko_feed_scroll_top";

type FeedMemoryCache = {
  userId: number;
  posts: any[];
  stories: LiveStory[];
  snapshotAt: string;
};

let feedMemoryCache: FeedMemoryCache | null = null;

type FeedViewState = {
  userId: number;
  postId: string;
  offsetTop: number;
};

let feedViewState: FeedViewState | null = null;
let activeFeedScrollElement: HTMLDivElement | null = null;

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

function HomeContent({ navigate }: { navigate: (path: string) => void }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  setSessionUser(Number(user?.id));
  const [optionsPostId, setOptionsPostId] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentUserId = Number(user?.id);
  const memoryFeed = feedMemoryCache?.userId === currentUserId ? feedMemoryCache : null;
  const cachedFeed = memoryFeed
    ? { posts: memoryFeed.posts }
    : getSessionCache<{ posts?: any[] }>("/posts/feed");
  const cachedStories = memoryFeed
    ? { stories: memoryFeed.stories }
    : getSessionCache<{ stories?: LiveStory[] }>("/stories");

  const convertPosts = (items: any[]): LiveFeedPost[] =>
    items.map((p) => ({
      post: {
        id: `live_${p.id}`,
        userId: String(p.userId),
        imageUrl: p.mediaUrl ?? `https://picsum.photos/seed/live${p.id}/600/900`,
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
        userId: Number(p.userId),
        displayName: p.authorDisplayName,
        username: p.authorUsername,
        avatarUrl: p.authorAvatarUrl,
        isFollowing: Boolean(p.isFollowing),
      },
    }));

  const [livePosts, setLivePosts] = useState<LiveFeedPost[]>(() => convertPosts(cachedFeed?.posts ?? []));
  const [liveStories, setLiveStories] = useState<LiveStory[]>(() => cachedStories?.stories ?? []);
  const [feedLoading, setFeedLoading] = useState(!cachedFeed);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>(() => {
    try {
      const raw = sessionStorage.getItem("yuniko_hidden_feed_posts");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  });
  const [hiddenNotice, setHiddenNotice] = useState<{ postId: string; message: string } | null>(null);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationBadgeCleared, setNotificationBadgeCleared] = useState(false);
  const feedSnapshotRef = useRef<string>(new Date().toISOString());
  const feedRefreshInFlightRef = useRef(false);
  const pendingFeedDataRef = useRef<{ posts?: any[]; feedSnapshotAt?: string } | null>(null);
  const pendingFeedPromiseRef = useRef<Promise<{ posts?: any[]; feedSnapshotAt?: string }> | null>(null);
  const suppressFeedPositionSaveRef = useRef(false);

  const prefetchLatestFeed = () => {
    if (!user || feedRefreshInFlightRef.current || pendingFeedPromiseRef.current) {
      return pendingFeedPromiseRef.current;
    }

    const promise = apiJson<{ posts?: any[]; feedSnapshotAt?: string }>("/posts/feed")
      .then((data) => {
        pendingFeedDataRef.current = data;
        return data;
      })
      .catch(() => {
        pendingFeedDataRef.current = null;
        throw new Error("Feed prefetch failed");
      })
      .finally(() => {
        pendingFeedPromiseRef.current = null;
      });

    pendingFeedPromiseRef.current = promise;
    return promise;
  };

  const applyFeedData = (feedData: { posts?: any[]; feedSnapshotAt?: string }) => {
    const snapshotAt = feedData.feedSnapshotAt ?? new Date().toISOString();
    setLivePosts(convertPosts(feedData.posts ?? []));
    setSessionCache("/posts/feed", feedData);
    feedSnapshotRef.current = snapshotAt;
    feedMemoryCache = {
      userId: Number(user!.id),
      posts: feedData.posts ?? [],
      stories: feedMemoryCache?.userId === Number(user!.id) ? feedMemoryCache.stories : [],
      snapshotAt,
    };
    try { sessionStorage.setItem("yuniko_feed_snapshot_at", snapshotAt); } catch {}
    setNewPostsCount(0);
    setFeedLoading(false);
    pendingFeedDataRef.current = null;
  };

  const refreshFeed = async () => {
    if (!user || feedRefreshInFlightRef.current) return;
    feedRefreshInFlightRef.current = true;
    try {
      const pendingFeed = pendingFeedDataRef.current;
      const pendingPromise = pendingFeedPromiseRef.current;
      const feedPromise = pendingPromise ?? apiJson<{ posts?: any[]; feedSnapshotAt?: string }>("/posts/feed");
      const storiesPromise = apiJson<{ stories?: LiveStory[] }>("/stories");

      const feedData = pendingFeed ?? await feedPromise;
      applyFeedData(feedData);

      void storiesPromise.then((storiesData) => {
        const stories = storiesData.stories ?? [];
        setSessionCache("/stories", storiesData);
        setLiveStories(stories);
        if (feedMemoryCache?.userId === Number(user.id)) {
          feedMemoryCache = { ...feedMemoryCache, stories };
        }
      }).catch(() => {});
    } catch {
      setFeedLoading(false);
    } finally {
      feedRefreshInFlightRef.current = false;
    }
  };

  const refreshFeedRef = useRef(refreshFeed);
  refreshFeedRef.current = refreshFeed;

  useEffect(() => {
    let timer: number | null = null;
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!detail) return;
      const notification = detail.notification as Record<string, unknown> | undefined;
      const eventType = String(detail.type ?? "");
      const notificationType = String(notification?.type ?? "");
      const feedRelevant = eventType === "story:view" || eventType.startsWith("post:") ||
        (eventType === "notification:new" && ["like", "comment", "share", "follow", "story_reaction", "story_reply"].includes(notificationType));
      if (!feedRelevant) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        void refreshFeedRef.current();
      }, 180);
    };
    window.addEventListener("yuniko:realtime", onRealtime);
    return () => {
      window.removeEventListener("yuniko:realtime", onRealtime);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  useLayoutEffect(() => {
    if (!user) return;

    const hasMemoryFeed = feedMemoryCache?.userId === Number(user.id);
    if (!hasMemoryFeed) return;

    const scrollElement = scrollRef.current;
    const target = feedViewState?.userId === Number(user.id) ? feedViewState : null;
    if (!scrollElement || !target) return;

    const postElement = scrollElement.querySelector<HTMLElement>(
      `[data-testid="feed-post-${target.postId}"]`,
    );
    if (!postElement) return;

    const containerTop = scrollElement.getBoundingClientRect().top;
    const postTop = postElement.getBoundingClientRect().top;
    const desiredTop = Math.max(0, postTop - containerTop - target.offsetTop);
    scrollElement.scrollTop = Math.min(
      desiredTop,
      Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight),
    );
  }, [user, livePosts.length]);

  useEffect(() => {
    if (!user) return;

    const hasMemoryFeed = feedMemoryCache?.userId === Number(user.id);
    const shouldInitialRefresh = !hasMemoryFeed;

    if (shouldInitialRefresh) {
      void refreshFeed();
    } else if (feedMemoryCache) {
      feedSnapshotRef.current = feedMemoryCache.snapshotAt;
    }

    let frame = 0;
    let captureTimer: number | null = null;
    let lastPositionCaptureAt = 0;
    let lastPositionStorageWriteAt = 0;

    const scrollElement = scrollRef.current;
    if (scrollElement) activeFeedScrollElement = scrollElement;

    const captureFeedPosition = (forcePersist = false) => {
      if (!scrollElement || activeFeedScrollElement !== scrollElement) return;

      const containerTop = scrollElement.getBoundingClientRect().top;
      const posts = Array.from(
        scrollElement.querySelectorAll<HTMLElement>('[data-testid^="feed-post-"]'),
      );
      const visiblePost = posts.find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > containerTop + 8;
      });

      if (!visiblePost) return;

      const postId = visiblePost.getAttribute("data-testid")?.replace("feed-post-", "");
      if (!postId) return;

      const offsetTop = visiblePost.getBoundingClientRect().top - containerTop;
      feedViewState = {
        userId: Number(user.id),
        postId,
        offsetTop,
      };

      const now = performance.now();
      if (!forcePersist && now - lastPositionStorageWriteAt < 500) return;
      try {
        sessionStorage.setItem(FEED_SCROLL_POSITION_KEY, JSON.stringify(feedViewState));
        lastPositionStorageWriteAt = now;
      } catch {}
    };

    const saveFeedPosition = () => {
      if (!scrollElement || activeFeedScrollElement !== scrollElement) return;
      if (suppressFeedPositionSaveRef.current) {
        suppressFeedPositionSaveRef.current = false;
        return;
      }

      const scheduleCapture = () => {
        captureTimer = null;
        if (frame || activeFeedScrollElement !== scrollElement) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          lastPositionCaptureAt = performance.now();
          captureFeedPosition();
        });
      };

      const remaining = 120 - (performance.now() - lastPositionCaptureAt);
      if (remaining <= 0) {
        if (!frame) scheduleCapture();
      } else if (captureTimer === null) {
        captureTimer = window.setTimeout(scheduleCapture, remaining);
      }
    };

    scrollElement?.addEventListener("scroll", saveFeedPosition, { passive: true });

    try { setNotificationBadgeCleared(sessionStorage.getItem("yuniko_notifications_badge_cleared") === "1"); } catch {}
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (detail?.type === "notification:new") {
        setUnreadNotifications((count) => count + 1);
        setNotificationBadgeCleared(false);
        try { sessionStorage.removeItem("yuniko_notifications_badge_cleared"); } catch {}
      }
      if (detail?.type === "post:new" && location === "/") {
        setNewPostsCount((count) => count + 1);
        const refresh = prefetchLatestFeed();
        if (refresh) void refresh.catch(() => {});
      }
    };
    window.addEventListener("yuniko:realtime", onRealtime);

    return () => {
      window.cancelAnimationFrame(frame);
      if (captureTimer !== null) window.clearTimeout(captureTimer);
      if (activeFeedScrollElement === scrollElement) {
        if (suppressFeedPositionSaveRef.current) {
          suppressFeedPositionSaveRef.current = false;
        } else {
          captureFeedPosition(true);
        }
        activeFeedScrollElement = null;
      }
      scrollElement?.removeEventListener("scroll", saveFeedPosition);
      window.removeEventListener("yuniko:realtime", onRealtime);
    };
  }, [user, location]);

  const hiddenPostSet = new Set(hiddenPostIds);
  const allFeedItems: Array<{ post: Post; author?: LiveAuthor }> =
    livePosts.filter(({ post }) => !hiddenPostSet.has(post.id)).map(({ post, author }) => ({ post, author }));

  const hidePost = (postId: string) => {
    setHiddenPostIds((prev) => {
      const next = prev.includes(postId) ? prev : [...prev, postId];
      try { sessionStorage.setItem("yuniko_hidden_feed_posts", JSON.stringify(next)); } catch {}
      return next;
    });
    setOptionsPostId(null);
    setHiddenNotice({ postId, message: "Publication masquée" });
    window.setTimeout(() => setHiddenNotice((current) => current?.postId === postId ? null : current), 5000);
  };

  const undoHidePost = (postId: string) => {
    setHiddenPostIds((prev) => {
      const next = prev.filter((id) => id !== postId);
      try { sessionStorage.setItem("yuniko_hidden_feed_posts", JSON.stringify(next)); } catch {}
      return next;
    });
    setHiddenNotice(null);
  };

  const toggleSavePost = async (postId: string) => {
    const numericId = postId.replace("live_", "");
    const target = livePosts.find(({ post }) => post.id === postId)?.post;
    if (!target) return;
    try {
      const result = await apiJson<{ saved: boolean; saves: number }>("/posts/" + numericId + "/save", { method: "POST" });
      setLivePosts((prev) => prev.map(({ post, author }) => post.id === postId
        ? { post: { ...post, isSaved: Boolean(result.saved), saves: Number(result.saves ?? post.saves) }, author }
        : { post, author }));
      window.dispatchEvent(new CustomEvent("yuniko:save-changed"));
      setOptionsPostId(null);
      setHiddenNotice({ postId, message: result.saved ? "Publication enregistrée" : "Publication retirée des enregistrements" });
      window.setTimeout(() => setHiddenNotice((current) => current?.postId === postId ? null : current), 3000);
    } catch {
      setHiddenNotice({ postId, message: "Impossible d'enregistrer cette publication." });
      window.setTimeout(() => setHiddenNotice((current) => current?.postId === postId ? null : current), 3000);
    }
  };

  const sharePost = async (postId: string) => {
    const entry = livePosts.find(({ post }) => post.id === postId);
    if (!entry) return;
    const { post: target, author } = entry;
    const numericId = postId.replace("live_", "");
    const url = (typeof window === "undefined" ? "" : window.location.origin) + "/post/" + postId;
    const title = (author?.displayName ?? "Yuniko") + " sur Yuniko";
    const text = target.caption?.trim() || "Découvre cette publication sur Yuniko.";
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      const result = await apiJson<{ shared: boolean; shares: number }>("/posts/" + numericId + "/share", {
        method: "POST",
        body: JSON.stringify({ channel: "native" }),
      });
      setLivePosts((prev) => prev.map(({ post, author: postAuthor }) => post.id === postId
        ? { post: { ...post, shares: Number(result.shares ?? post.shares) }, author: postAuthor }
        : { post, author: postAuthor }));
      setOptionsPostId(null);
      setHiddenNotice({ postId, message: "Publication partagée" });
      window.setTimeout(() => setHiddenNotice((current) => current?.postId === postId ? null : current), 3000);
    } catch {
      // A cancelled native share must not count as a share.
    }
  };

  const submitReport = async (postId: string, reason: string) => {
    if (reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await apiJson(`/posts/${postId.replace("live_", "")}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setReportingPostId(null);
      setOptionsPostId(null);
      setHiddenNotice({ postId, message: "Merci. Ton signalement a été envoyé." });
      window.setTimeout(() => setHiddenNotice((current) => current?.postId === postId ? null : current), 5000);
    } catch {}
    finally { setReportSubmitting(false); }
  };

  return (
    <div
      className="home-screen relative w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] min-h-0 flex flex-col overflow-hidden"
      style={{ minHeight: "var(--yuniko-vh)", background: "#050509", backgroundImage: "radial-gradient(ellipse 48% 30% at -2% 34%, rgba(0,140,255,.16), transparent 68%), radial-gradient(ellipse 48% 34% at 102% 56%, rgba(255,20,147,.14), transparent 68%)" }}
    >
      <header
        className="fixed inset-x-0 top-0 z-50 flex w-full min-w-0 items-center justify-between px-4"
        style={{
          height: "72px",
          background: "rgba(5,5,9,0.92)",
          borderBottom: "1px solid rgba(255,255,255,0.035)",
        }}
        data-testid="home-header"
      >
        <button onClick={() => { if (window.location.pathname !== "/") navigate("/"); }} className="shrink-0" aria-label="Yuniko home">
          <span className="text-[clamp(31px,8vw,39px)] font-black tracking-[-0.055em] leading-none" style={{ background: "linear-gradient(90deg, #FF1493 0%, #FF2FA4 42%, #008CFF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Yuniko</span>
        </button>
        <div className="flex items-center gap-5">
          <motion.button whileTap={{ scale: 0.84 }} onClick={() => { setUnreadNotifications(0); setNotificationBadgeCleared(true); try { sessionStorage.setItem("yuniko_notifications_badge_cleared", "1"); } catch {} navigate("/notifications"); }} className="relative flex h-9 w-9 items-center justify-center" aria-label={t("notifications")}>
            <Bell size={25} strokeWidth={1.7} style={{ color: "rgba(255,210,235,0.88)" }} />
            {!notificationBadgeCleared && unreadNotifications > 0 && <span className="absolute -right-2 -top-1 min-w-4 h-4 rounded-full px-1 text-[9px] font-bold text-white flex items-center justify-center" style={{ background: "#FF1493", boxShadow: "0 0 8px rgba(255,20,147,.45)" }} aria-label="Nouvelles notifications">1+</span>}
          </motion.button>
          <motion.button whileTap={{ scale: 0.84 }} onClick={() => navigate("/add-friends")} className="relative flex h-9 w-9 items-center justify-center" aria-label={t("addFriends")}>
            <UserPlus size={25} strokeWidth={1.75} style={{ color: "rgba(255,210,235,0.92)" }} />
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {!isOnline && (
          <motion.div key="offline-banner" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="relative z-30 mx-4 flex items-center justify-center gap-1.5 rounded-xl py-1.5" style={{ background: "rgba(239,68,68,0.88)", backdropFilter: "blur(8px)" }}>
            <WifiOff size={12} className="text-white" />
            <span className="text-white text-xs font-medium">Offline — showing cached posts</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main ref={scrollRef} className="relative z-10 flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-[clamp(10px,3.5vw,22px)] pb-24" style={{ minHeight: 0, paddingTop: "84px", WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain", touchAction: "pan-y" }} data-testid="posts-feed">
        {feedLoading ? <LoadingSkeleton variant="feed" /> : (
          <div className="mx-auto w-full max-w-[680px]">
            {allFeedItems.length === 0 ? (
              <div className="flex min-h-[55vh] flex-col items-center justify-center px-8 text-center">
                <Globe size={34} style={{ color: "#FF2FA4" }} className="mb-3" />
                <p className="font-semibold text-white">Your feed is empty</p>
                <p className="mt-1 text-sm text-white/45">Be the first to share something with the Yuniko community.</p>
                <button onClick={() => navigate("/create")} className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#FF1493,#008CFF)", boxShadow: "0 6px 22px rgba(255,20,147,.22)" }}>Create a post</button>
              </div>
            ) : (
              <>
                <StoryRail stories={liveStories} ownStoryId={liveStories.find((story) => Number(story.userId) === Number(user?.id))?.id} />
                {allFeedItems.map(({ post, author }, index) => (
                  <ReactFragment key={post.id}>
                    <article className="mb-7 w-full" data-testid={`feed-post-${post.id}`}>
                      <PostCard post={post} liveAuthor={author} deferImage={index > 0} priority={index === 0} onOptions={post.isSponsored ? undefined : () => setOptionsPostId(post.id)} />
                    </article>
                    {(index + 1) % 11 === 0 && index + 1 < allFeedItems.length && <StoryCardRail stories={liveStories.filter((story) => Number(story.userId) !== Number(user?.id))} ownStory={liveStories.find((story) => Number(story.userId) === Number(user?.id))} />}
                  </ReactFragment>
                ))}
              </>
            )}
          </div>
        )}
      </main>

      <BottomNav
        newPostsCount={newPostsCount}
        onHomePress={() => {
          if (location !== "/") return;

          feedViewState = null;
          try { sessionStorage.removeItem(FEED_SCROLL_POSITION_KEY); } catch {}

          const scrollElement = scrollRef.current;
          if (scrollElement) {
            suppressFeedPositionSaveRef.current = true;
            scrollElement.scrollTo({ top: 0, behavior: "auto" });
          }

          const refreshIfNeeded = async () => {
            let count = newPostsCount;

            if (count <= 0) {
              try {
                const data = await apiJson<{ newPostsCount?: number }>(
                  `/posts/feed/updates?since=${encodeURIComponent(feedSnapshotRef.current)}`,
                );
                count = Math.max(0, Number(data.newPostsCount) || 0);
                if (count > 0) setNewPostsCount(count);
              } catch {
                return;
              }
            }

            if (count <= 0) return;

            setNewPostsCount(0);

            const pendingFeed = pendingFeedDataRef.current;
            if (pendingFeed) {
              applyFeedData(pendingFeed);
              return;
            }

            const pendingFeedPromise = pendingFeedPromiseRef.current ?? prefetchLatestFeed();
            if (pendingFeedPromise) {
              try {
                const feedData = await pendingFeedPromise;
                applyFeedData(feedData);
              } catch {}
            }
          };

          void refreshIfNeeded();
        }}
      />

      <AnimatePresence>
        {optionsPostId && (
          <ScreenPortal>
            <motion.div key="options-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/65" onClick={() => { setOptionsPostId(null); setReportingPostId(null); }} />
            <motion.div key="options-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 340 }} className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-2xl overflow-hidden" style={{ background: "rgba(8,8,13,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-10 h-1 rounded-full bg-white/18 mx-auto mt-3 mb-4" />
              {reportingPostId === optionsPostId ? (
                <>
                  <div className="px-5 pb-3">
                    <p className="text-white text-base font-bold">Pourquoi signalez-vous cette publication ?</p>
                    <p className="mt-1 text-xs text-white/45">Le signalement sera examiné selon les règles de Yuniko.</p>
                  </div>
                  {["Spam ou contenu trompeur", "Harcèlement ou comportement abusif", "Contenu inapproprié", "Fausse information", "Autre"].map((reason) => (
                    <button key={reason} disabled={reportSubmitting} onClick={() => void submitReport(optionsPostId, reason)} className="w-full flex items-center gap-3 px-5 py-4 text-left text-white/85 text-sm font-medium disabled:opacity-50" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>{reason}</button>
                  ))}
                  <button onClick={() => setReportingPostId(null)} className="w-full py-4 text-white/45 text-sm font-medium">Retour</button>
                </>
              ) : (
                <>
                  {(() => {
                    const selectedPost = livePosts.find(({ post }) => post.id === optionsPostId)?.post;
                    return [
                      { icon: <Bookmark size={18} />, label: selectedPost?.isSaved ? "Retirer des enregistrements" : t("savePost"), action: () => void toggleSavePost(optionsPostId) },
                      { icon: <Share2 size={18} />, label: t("sharePost"), action: () => void sharePost(optionsPostId) },
                      { icon: <EyeOff size={18} />, label: "Masquer la publication", action: () => hidePost(optionsPostId) },
                      { icon: <Flag size={18} className="text-red-400" />, label: <span className="text-red-400">Signaler la publication</span>, action: () => setReportingPostId(optionsPostId) },
                    ];
                  })().map((item, i) => (
                    <button key={i} onClick={item.action} className="w-full flex items-center gap-3 px-5 py-4 text-white/85 text-sm font-medium" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{item.icon}{item.label}</button>
                  ))}
                  <button onClick={() => setOptionsPostId(null)} className="w-full py-4 text-white/45 text-sm font-medium">{t("cancel")}</button>
                </>
              )}
            </motion.div>
          </ScreenPortal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hiddenNotice && (
          <motion.div key="hidden-notice" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-[82px] left-1/2 z-[70] flex w-[calc(100%-28px)] max-w-[402px] -translate-x-1/2 items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-2xl" style={{ background: "rgba(25,25,31,.97)", border: "1px solid rgba(255,255,255,.1)" }}>
            <span className="text-sm font-medium text-white">{hiddenNotice.message}</span>
            {hiddenNotice.message === "Publication masquée" && <button onClick={() => undoHidePost(hiddenNotice.postId)} className="shrink-0 text-sm font-bold" style={{ color: "#42A5FF" }}>Annuler</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StoryRail({ stories, ownStoryId }: { stories: LiveStory[]; ownStoryId?: number }) {
  const ownStory = ownStoryId ? stories.find((story) => Number(story.id) === Number(ownStoryId)) : undefined;
  return (
    <section className="relative mb-6 w-full rounded-[18px] px-3 py-2.5" style={{ background: "rgba(5,5,9,0.9)", border: "1px solid rgba(255,255,255,0.045)", boxShadow: "0 8px 24px rgba(0,0,0,.16)" }} data-testid="stories-section">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-[18px] font-bold tracking-[-0.02em] text-white">Stories</h2></div>
      <div className="flex items-start gap-[clamp(10px,2.6vw,16px)] overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain", overscrollBehaviorY: "auto", touchAction: "pan-x pan-y" }} data-testid="stories-row">
        <CreateStoryAvatar />
        {ownStory && <LiveStoryAvatar story={ownStory} isOwn />}
        {stories.filter((story) => Number(story.id) !== Number(ownStoryId)).map((story) => <LiveStoryAvatar key={`ls_${story.id}`} story={story} />)}
      </div>
    </section>
  );
}

function CreateStoryAvatar() {
  const [, setLocation] = useLocation();
  return (
    <motion.button onClick={() => setLocation("/create?mode=story")} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 64 }} whileTap={{ scale: 0.9 }} aria-label="Create story" data-testid="create-story-avatar">
      <div className="relative"><div className="w-[54px] h-[54px] rounded-full p-[2px]" style={{ background: "linear-gradient(135deg, #FF1493 0%, #008CFF 100%)", boxShadow: "0 0 10px rgba(255,0,110,0.35)" }}><div className="flex h-full w-full items-center justify-center rounded-full bg-[#0D0B14] text-white"><span className="text-[27px] font-light leading-none">+</span></div></div></div>
      <span className="text-white/70 text-[10px] font-medium leading-tight text-center truncate max-w-[60px]">Create</span>
    </motion.button>
  );
}

function StoryCardRail({ stories, ownStory }: { stories: LiveStory[]; ownStory?: LiveStory }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef({ x: 0, y: 0, active: false });
  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => { const touch = event.touches[0]; touchRef.current = { x: touch.clientX, y: touch.clientY, active: true }; };
  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => { if (!touchRef.current.active || !rowRef.current) return; const touch = event.touches[0]; const dx = touch.clientX - touchRef.current.x; const dy = touch.clientY - touchRef.current.y; if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < 4) return; event.preventDefault(); rowRef.current.scrollLeft -= dx; touchRef.current.x = touch.clientX; touchRef.current.y = touch.clientY; };
  const onTouchEnd = () => { touchRef.current.active = false; };
  return (
    <section className="relative mb-7 w-full" data-testid="stories-card-section">
      <div ref={rowRef} className="flex items-start gap-2.5 overflow-x-auto no-scrollbar px-0.5" style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain", overscrollBehaviorY: "auto", touchAction: "pan-y" }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd} data-testid="stories-card-row">
        <CreateStoryCard />
        {ownStory && <StoryCard key={`own_${ownStory.id}`} story={ownStory} label="Your story" />}
        {stories.filter((story) => Number(story.id) !== Number(ownStory?.id)).map((story) => <StoryCard key={`sc_${story.id}`} story={story} />)}
      </div>
    </section>
  );
}

function CreateStoryCard() {
  const [, setLocation] = useLocation();
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[15px] p-[1.5px]" style={{ width: "clamp(108px, 28vw, 140px)", aspectRatio: "9 / 16", background: "linear-gradient(135deg,#FF1493 0%,#FF2B9A 38%,#008CFF 100%)", boxShadow: "0 8px 22px rgba(0,0,0,.28), 0 0 14px rgba(255,20,147,.12)" }} data-testid="create-story-card">
      <motion.button onClick={() => setLocation("/create?mode=story")} whileTap={{ scale: 0.97 }} className="relative h-full w-full overflow-hidden rounded-[13.5px] text-left" style={{ background: "linear-gradient(145deg,#171722 0%,#202034 55%,#11111a 100%)" }} aria-label="Create story">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-white"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"><span className="text-[30px] font-light leading-none">+</span></div><span className="text-[12px] font-bold">Create story</span></div>
      </motion.button>
    </div>
  );
}

function StoryCard({ story, isOwn = false, storyId, userId, label }: { story?: LiveStory; isOwn?: boolean; storyId?: number; userId?: string; label?: string }) {
  const [, setLocation] = useLocation();
  const displayName = isOwn ? label ?? "Your story" : story?.authorDisplayName ?? "Story";
  const openStory = () => { if (isOwn) { setLocation(storyId ? `/story/live_${storyId}` : "/create?mode=story"); return; } if (story) setLocation(`/story/live_${story.id}`); };
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[15px] p-[1.5px]" style={{ width: "clamp(108px, 28vw, 140px)", aspectRatio: "9 / 16", background: "linear-gradient(135deg,#FF1493 0%,#FF2B9A 38%,#008CFF 100%)", boxShadow: "0 8px 22px rgba(0,0,0,.28), 0 0 14px rgba(255,20,147,.12)" }} data-testid={`story-card-frame-${userId ?? story?.id ?? "story"}`}>
      <motion.button onClick={openStory} whileTap={{ scale: 0.97 }} className="relative h-full w-full overflow-hidden rounded-[13.5px] text-left" style={{ background: "#16161d" }} aria-label={`Open ${displayName}`} data-testid={`story-card-${userId ?? story?.id ?? "story"}`}>
        {story?.mediaUrl ? <img src={story.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : <div className="absolute inset-0" style={{ background: "linear-gradient(145deg,#171722 0%,#202034 55%,#11111a 100%)" }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,.03) 35%, rgba(0,0,0,.84) 100%)" }} />
        <span className="absolute bottom-2.5 left-2.5 right-2.5 truncate text-[12px] font-bold leading-tight text-white">{displayName}</span>
      </motion.button>
    </div>
  );
}

function LiveStoryAvatar({ story, isOwn = false }: { story: LiveStory; isOwn?: boolean }) {
  const [, setLocation] = useLocation();
  const avatarSrc = story.authorAvatarUrl ?? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(story.authorDisplayName)}&backgroundColor=FF006E`;
  return (
    <motion.button onClick={() => setLocation(`/story/live_${story.id}`)} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 64 }} whileTap={{ scale: 0.9 }}>
      <div className="relative"><div className="w-[54px] h-[54px] rounded-full p-[2px]" style={{ background: "linear-gradient(135deg, #FF1493 0%, #008CFF 100%)", boxShadow: "0 0 10px rgba(255,0,110,0.35)" }}><img src={avatarSrc} alt={story.authorDisplayName} className="w-full h-full rounded-full object-cover" style={{ border: "2px solid #0D0B14" }} loading="lazy" /></div></div>
      <span className="text-white/70 text-[10px] font-medium leading-tight text-center truncate max-w-[60px]">{story.authorDisplayName}</span>
    </motion.button>
  );
}

const Home = memo(function Home() {
  const [, navigate] = useLocation();
  return <HomeContent navigate={navigate} />;
});

export default Home;
