import { useState, useEffect, useRef, Fragment as ReactFragment } from "react";
import { useLocation } from "wouter";
import { Bell, UserPlus, Globe, Bookmark, Share2, Flag, EyeOff, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Post } from "@/data/mockData";
import StoryAvatar from "@/components/StoryAvatar";
import PostCard, { type LiveAuthor } from "@/components/PostCard";
import BottomNav from "@/components/BottomNav";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import ScreenPortal from "@/components/ScreenPortal";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { fetchSessionJson, getSessionCache, setSessionUser, warmSessionData } from "@/lib/session-cache";

const NAV_H = "calc(64px + env(safe-area-inset-bottom, 0px))";

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
  const { user } = useAuth();
  setSessionUser(Number(user?.id));
  const [optionsPostId, setOptionsPostId] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const scrollRef = useRef<HTMLDivElement>(null);

  const cachedFeed = getSessionCache<{ posts?: any[] }>("/posts/feed");
  const cachedStories = getSessionCache<{ stories?: LiveStory[] }>("/stories");

  const convertPosts = (items: any[]): LiveFeedPost[] =>
    items.map((p) => ({
      post: {
        id: `live_${p.id}`,
        userId: `live_${p.userId}`,
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

  useEffect(() => {
    if (!user) return;

    fetchSessionJson<{ posts?: any[] }>("/posts/feed")
      .then((data) => {
        setLivePosts(convertPosts(data.posts ?? []));
        setFeedLoading(false);
        window.setTimeout(() => warmSessionData(Number(user.id)), 0);
      })
      .catch(() => {
        setLivePosts([]);
        setFeedLoading(false);
      });

    fetchSessionJson<{ stories?: LiveStory[] }>("/stories")
      .then((data) => setLiveStories(data.stories ?? []))
      .catch(() => {})
  }, [user]);

  const allFeedItems: Array<{ post: Post; author?: LiveAuthor }> =
    livePosts.map(({ post, author }) => ({ post, author }));

  return (
    <div
      className="home-screen relative min-h-full w-full min-w-0 overflow-hidden"
      style={{ minHeight: "var(--yuniko-vh)", background: "#050509", backgroundImage: "radial-gradient(ellipse 48% 30% at -2% 34%, rgba(0,140,255,.16), transparent 68%), radial-gradient(ellipse 48% 34% at 102% 56%, rgba(255,20,147,.14), transparent 68%)" }}
    >
      <header
        className="fixed inset-x-0 top-0 z-50 flex w-full min-w-0 items-center justify-between px-4"
        style={{
          height: "72px",
          background: "rgba(5,5,9,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.035)",
        }}
        data-testid="home-header"
      >
        <button onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })} className="shrink-0" aria-label="Yuniko home">
          <span
            className="text-[clamp(31px,8vw,39px)] font-black tracking-[-0.055em] leading-none"
            style={{
              background: "linear-gradient(90deg, #FF1493 0%, #FF2FA4 42%, #008CFF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Yuniko
          </span>
        </button>
        <div className="flex items-center gap-5">
          <motion.button whileTap={{ scale: 0.84 }} onClick={() => setLocation("/notifications")} className="relative flex h-9 w-9 items-center justify-center" aria-label={t("notifications")}>
            <Bell size={25} strokeWidth={1.7} style={{ color: "rgba(255,210,235,0.88)" }} />
            <span className="absolute -right-0.5 top-0.5 h-2 w-2 rounded-full" style={{ background: "#FF1493", boxShadow: "0 0 8px rgba(255,20,147,.7)" }} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.84 }} onClick={() => setLocation("/add-friends")} className="relative flex h-9 w-9 items-center justify-center" aria-label={t("addFriends")}>
            <UserPlus size={25} strokeWidth={1.75} style={{ color: "rgba(255,210,235,0.92)" }} />
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="relative z-30 mx-4 flex items-center justify-center gap-1.5 rounded-xl py-1.5"
            style={{ background: "rgba(239,68,68,0.88)", backdropFilter: "blur(8px)" }}
          >
            <WifiOff size={12} className="text-white" />
            <span className="text-white text-xs font-medium">Offline — showing cached posts</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        ref={scrollRef}
        className="relative z-10 min-w-0 overflow-y-auto overflow-x-hidden px-[clamp(10px,3.5vw,22px)] pb-[calc(92px+env(safe-area-inset-bottom,0px))]"
        style={{
          minHeight: "calc(var(--yuniko-vh) - 72px)",
          paddingTop: "84px",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          touchAction: "pan-y",
        }}
        data-testid="posts-feed"
      >
        {feedLoading ? <LoadingSkeleton variant="feed" /> : allFeedItems.length === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center px-8 text-center">
            <Globe size={34} style={{ color: "#FF2FA4" }} className="mb-3" />
            <p className="font-semibold text-white">Your feed is empty</p>
            <p className="mt-1 text-sm text-white/45">Be the first to share something with the Yuniko community.</p>
            <button
              onClick={() => setLocation("/create")}
              className="mt-5 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#FF1493,#008CFF)", boxShadow: "0 6px 22px rgba(255,20,147,.22)" }}
            >
              Create a post
            </button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[680px]">
            <StoryRail
  stories={liveStories.filter((story) => Number(story.userId) !== Number(user?.id))}
  ownStoryId={liveStories.find((story) => Number(story.userId) === Number(user?.id))?.id}
/>
            {allFeedItems.map(({ post, author }, index) => (
              <ReactFragment key={post.id}>
                <article className="mb-7 w-full" data-testid={`feed-post-${post.id}`}>
                  <PostCard post={post} liveAuthor={author} onOptions={post.isSponsored ? undefined : () => setOptionsPostId(post.id)} />
                </article>
                {(index + 1) % 11 === 0 && index + 1 < allFeedItems.length && <StoryCardRail
  stories={liveStories.filter((story) => Number(story.userId) !== Number(user?.id))}
  ownStory={liveStories.find((story) => Number(story.userId) === Number(user?.id))}
 />}
              </ReactFragment>
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      <AnimatePresence>
        {optionsPostId && (
          <ScreenPortal>
            <motion.div key="options-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/65" onClick={() => setOptionsPostId(null)} />
            <motion.div
              key="options-sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 340 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-2xl overflow-hidden"
              style={{ background: "rgba(8,8,13,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="w-10 h-1 rounded-full bg-white/18 mx-auto mt-3 mb-4" />
              {[
                { icon: <Bookmark size={18} />, label: t("savePost") },
                { icon: <Share2 size={18} />, label: t("sharePost") },
                { icon: <EyeOff size={18} />, label: t("hide") },
                { icon: <Flag size={18} className="text-red-400" />, label: <span className="text-red-400">{t("report")}</span> },
              ].map((item, i) => (
                <button key={i} onClick={() => setOptionsPostId(null)} className="w-full flex items-center gap-3 px-5 py-4 text-white/85 text-sm font-medium" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {item.icon}{item.label}
                </button>
              ))}
              <button onClick={() => setOptionsPostId(null)} className="w-full py-4 text-white/45 text-sm font-medium">{t("cancel")}</button>
            </motion.div>
          </ScreenPortal>
        )}
      </AnimatePresence>
    </div>
  );
}

function StoryRail({ stories, ownStoryId }: { stories: LiveStory[]; ownStoryId?: number }) {
  return (
    <section
      className="relative mb-6 w-full rounded-[18px] px-3 py-2.5"
      style={{
        background: "rgba(5,5,9,0.9)",
        border: "1px solid rgba(255,255,255,0.045)",
        boxShadow: "0 8px 24px rgba(0,0,0,.16)",
      }}
      data-testid="stories-section"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-white">Stories</h2>
      </div>
      <div
        className="flex items-start gap-[clamp(10px,2.6vw,16px)] overflow-x-auto no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain", touchAction: "pan-x" }}
        data-testid="stories-row"
      >
        <StoryAvatar userId="me" isOwn storyId={ownStoryId} />
        {stories.map((story) => (
          <LiveStoryAvatar key={`ls_${story.id}`} story={story} />
        ))}
      </div>
    </section>
  );
}

function StoryCardRail({ stories, ownStory }: { stories: LiveStory[]; ownStory?: LiveStory }) {
  return (
    <section
      className="relative mb-7 w-full"
      data-testid="stories-card-section"
    >
      <div
        className="flex items-start gap-2.5 overflow-x-auto no-scrollbar px-0.5"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain", touchAction: "pan-x" }}
        data-testid="stories-card-row"
      >
        <StoryCard
          isOwn
          story={ownStory}
          storyId={ownStory?.id}
          userId="me"
          label="Your story"
        />
        {stories.map((story) => (
          <StoryCard key={`sc_${story.id}`} story={story} />
        ))}
      </div>
    </section>
  );
}

function StoryCard({
  story,
  isOwn = false,
  storyId,
  userId,
  label,
}: {
  story?: LiveStory;
  isOwn?: boolean;
  storyId?: number;
  userId?: string;
  label?: string;
}) {
  const [, setLocation] = useLocation();
  const { user: authUser } = useAuth();

  const displayName = isOwn
    ? label ?? "Your story"
    : story?.authorDisplayName ?? "Story";

  const avatarSrc = isOwn
    ? authUser?.avatarUrl ??
      `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(authUser?.displayName ?? "U")}&backgroundColor=FF006E`
    : story?.authorAvatarUrl ??
      `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=FF006E`;

  const openStory = () => {
    if (isOwn) {
      setLocation(storyId ? `/story/live_${storyId}` : "/create?mode=story");
      return;
    }
    if (story) setLocation(`/story/live_${story.id}`);
  };

  return (
    <motion.button
      onClick={openStory}
      whileTap={{ scale: 0.97 }}
      className="relative shrink-0 overflow-hidden rounded-[14px] text-left"
      style={{
        width: "clamp(108px, 28vw, 140px)",
        aspectRatio: "9 / 16",
        background: "#16161d",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 22px rgba(0,0,0,.28)",
      }}
      aria-label={`Open ${displayName}`}
      data-testid={`story-card-${userId ?? story?.id ?? "story"}`}
    >
      <img
        src={story?.mediaUrl ?? avatarSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,.04) 35%, rgba(0,0,0,.82) 100%)",
        }}
      />
      <div
        className="absolute left-2.5 top-2.5 h-9 w-9 overflow-hidden rounded-full p-[2px]"
        style={{
          background: "linear-gradient(135deg,#FF1493 0%,#008CFF 100%)",
          boxShadow: "0 0 10px rgba(255,20,147,.28)",
        }}
      >
        <img
          src={avatarSrc}
          alt=""
          className="h-full w-full rounded-full object-cover"
          style={{ border: "2px solid #111118" }}
        />
      </div>
      <span className="absolute bottom-2.5 left-2.5 right-2.5 truncate text-[12px] font-bold leading-tight text-white">
        {displayName}
      </span>
    </motion.button>
  );
}

function LiveStoryAvatar({ story }: { story: LiveStory }) {
  const [, setLocation] = useLocation();
  const avatarSrc =
    story.authorAvatarUrl ??
    `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(story.authorDisplayName)}&backgroundColor=FF006E`;

  return (
    <motion.button
      onClick={() => setLocation(`/story/live_${story.id}`)}
      className="flex flex-col items-center gap-1 flex-shrink-0"
      style={{ minWidth: 64 }}
      whileTap={{ scale: 0.9 }}
    >
      <div className="relative">
        <div
          className="w-[54px] h-[54px] rounded-full p-[2px]"
          style={{ background: "linear-gradient(135deg, #FF1493 0%, #008CFF 100%)", boxShadow: "0 0 10px rgba(255,0,110,0.35)" }}
        >
          <img
            src={avatarSrc}
            alt={story.authorDisplayName}
            className="w-full h-full rounded-full object-cover"
            style={{ border: "2px solid #0D0B14" }}
            loading="lazy"
          />
        </div>
      </div>
      <span className="text-white/70 text-[10px] font-medium leading-tight text-center truncate max-w-[60px]">
        {story.authorDisplayName}
      </span>
    </motion.button>
  );
}
