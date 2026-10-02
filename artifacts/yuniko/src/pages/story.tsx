import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { X, Send, Pause, Volume2, VolumeX, Heart, MapPin, BadgeCheck } from "lucide-react";
import { stories, getUserById } from "@/data/mockData";
import { t } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LoadingSkeleton } from "@/components/ui/skeleton";

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface LiveStory {
  id: number;
  userId: number;
  mediaUrl: string;
  caption: string;
  createdAt: string;
  authorDisplayName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  location?: string | null;
}

interface ViewerStory {
  id: string;
  userId: string;
  imageUrl: string;
  timestamp: string;
  location?: string | null;
}

export default function StoryViewer() {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "u1";
  const { user: authUser } = useAuth();
  const isLiveStory = userId.startsWith("live_");
  const mockUser = getUserById(userId);
  const [liveStory, setLiveStory] = useState<LiveStory | null>(null);
  const [liveStoryLoading, setLiveStoryLoading] = useState(isLiveStory);

  useEffect(() => {
    if (!isLiveStory || !authUser) return;
    const storyId = Number(userId.slice("live_".length));
    if (!Number.isInteger(storyId) || storyId <= 0) {
      setLiveStoryLoading(false);
      return;
    }

    fetch(`/api/stories/${storyId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Story unavailable");
        const data = (await response.json()) as { story?: LiveStory };
        setLiveStory(data.story ?? null);
        if (data.story) {
          apiFetch(`/stories/${storyId}/view`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }).catch(() => {});
        }
      })
      .catch(() => setLiveStory(null))
      .finally(() => setLiveStoryLoading(false));
  }, [isLiveStory, authUser, userId]);

  const storyUser = isLiveStory && liveStory
    ? {
        id: String(liveStory.userId),
        displayName: liveStory.authorDisplayName,
        username: liveStory.authorUsername,
        avatar: liveStory.authorAvatarUrl ??
          `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(liveStory.authorDisplayName)}&backgroundColor=FF006E`,
        verified: false,
      }
    : mockUser;

  const userStories: ViewerStory[] = isLiveStory
    ? liveStory
      ? [{
          id: String(liveStory.id),
          userId: String(liveStory.userId),
          imageUrl: liveStory.mediaUrl,
          timestamp: relativeTime(liveStory.createdAt),
          location: liveStory.location ?? null,
        }]
      : []
    : stories
        .filter((s) => s.userId === userId)
        .map((s) => ({
          id: s.id,
          userId: s.userId,
          imageUrl: s.imageUrl,
          timestamp: s.timestamp,
          location: null,
        }));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [liked, setLiked] = useState(false);
  const [reactionShown, setReactionShown] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const STORY_DURATION = 5000;
  const segmentCount = Math.max(5, userStories.length);

  useEffect(() => {
    if (paused || userStories.length === 0) return;

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < userStories.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          }
          setLocation("/");
          return 100;
        }
        return prev + 100 / (STORY_DURATION / 100);
      });
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentIndex, paused, userStories.length, setLocation]);

  const goNext = () => {
    if (currentIndex < userStories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      setLocation("/");
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  };

  const toggleReaction = () => {
    setLiked((value) => !value);
    setReactionShown(true);
    window.setTimeout(() => setReactionShown(false), 900);
  };

  if (liveStoryLoading) return <LoadingSkeleton variant="story" />;

  if (!storyUser || userStories.length === 0) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50">{t("noStories")}</p>
          <button onClick={() => setLocation("/")} className="mt-4" style={{ color: "#FF3D9A" }}>{t("back")}</button>
        </div>
      </div>
    );
  }

  const currentStory = userStories[currentIndex];

  return (
    <div
      className="min-h-screen w-full overflow-hidden bg-black"
      style={{
        backgroundImage: "radial-gradient(ellipse 42% 75% at 0% 50%, rgba(255,20,147,.20), transparent 72%), radial-gradient(ellipse 42% 75% at 100% 50%, rgba(0,140,255,.20), transparent 72%)",
      }}
      data-testid="story-viewer"
    >
      <div
        className="relative mx-auto h-[calc(100vh-64px)] min-h-[680px] w-full max-w-[752px] overflow-hidden bg-[#08070d] shadow-[0_0_70px_rgba(0,0,0,.65)] md:my-8 md:rounded-[28px]"
      >
        <div
          className="absolute left-0 right-0 top-[222px] bottom-[228px] z-0 overflow-hidden bg-black"
          data-testid="story-media"
        >
          <img
            src={currentStory.imageUrl}
            alt="Story"
            className="h-full w-full object-cover"
          />
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[250px]"
          style={{ background: "linear-gradient(to bottom, rgba(4,3,9,.98) 0%, rgba(4,3,9,.92) 55%, rgba(4,3,9,.20) 88%, transparent 100%)" }}
        />

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[280px]"
          style={{ background: "linear-gradient(to top, rgba(4,3,9,.98) 0%, rgba(4,3,9,.94) 42%, rgba(4,3,9,.28) 78%, transparent 100%)" }}
        />

        <div className="absolute left-8 right-8 top-10 z-40 flex gap-4" data-testid="story-progress">
          {Array.from({ length: segmentCount }).map((_, i) => {
            const isRealSegment = i < userStories.length;
            const width = !isRealSegment
              ? "0%"
              : i < currentIndex
                ? "100%"
                : i === currentIndex
                  ? `${progress}%`
                  : "0%";

            return (
              <div
                key={i}
                className="h-[4px] min-w-0 flex-1 overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,.18)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width,
                    background: "linear-gradient(90deg,#FF1493 0%,#8B5CF6 50%,#008CFF 100%)",
                    boxShadow: "0 0 8px rgba(255,20,147,.32)",
                    transition: "width .1s linear",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="absolute left-8 right-8 top-[104px] z-40 flex items-center justify-between gap-4">
          <button
            onClick={() => setLocation(`/user/${storyUser.id}`)}
            className="flex min-w-0 items-center gap-3 text-left"
            data-testid="btn-story-user"
          >
            <div
              className="h-[108px] w-[108px] shrink-0 rounded-full p-[4px]"
              style={{
                background: "linear-gradient(135deg,#FF1493 0%,#8B5CF6 52%,#008CFF 100%)",
                boxShadow: "0 0 16px rgba(255,20,147,.28)",
              }}
            >
              <img
                src={storyUser.avatar}
                alt={storyUser.displayName}
                className="h-full w-full rounded-full border-[5px] border-[#090810] object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[34px] font-bold tracking-[-.03em] text-white">{storyUser.displayName}</span>
                {storyUser.verified && <BadgeCheck size={15} className="fill-blue-300 text-blue-300" />}
              </div>
              <span className="text-[23px] font-medium text-white/75">{currentStory.timestamp} {t("ago")}</span>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => setPaused((value) => !value)}
              className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#34364b]/90 text-white shadow-lg backdrop-blur-md"
              aria-label={paused ? "Resume story" : "Pause story"}
              data-testid="btn-story-pause"
            >
              {paused ? <span className="text-[22px] font-black">▶</span> : <Pause size={23} strokeWidth={2.2} />}
            </button>
            <button
              onClick={() => setMuted((value) => !value)}
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#34364b]/90 text-white shadow-lg backdrop-blur-md"
              aria-label={muted ? "Unmute story" : "Mute story"}
              data-testid="btn-story-mute"
            >
              {muted ? <VolumeX size={24} strokeWidth={2.1} /> : <Volume2 size={24} strokeWidth={2.1} />}
            </button>
            <button
              onClick={() => setLocation("/")}
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#34364b]/90 text-white shadow-lg backdrop-blur-md"
              aria-label="Close story"
              data-testid="btn-close-story"
            >
              <X size={26} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 top-[238px] bottom-[220px] z-20 flex">
          <button aria-label="Previous story" className="h-full w-1/2 cursor-default" onClick={goPrev} />
          <button aria-label="Next story" className="h-full w-1/2 cursor-default" onClick={goNext} />
        </div>

        {reactionShown && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <Heart
              size={118}
              strokeWidth={1.4}
              className="animate-pulse"
              style={{
                color: "#FF7BC5",
                fill: "rgba(255,20,147,.20)",
                filter: "drop-shadow(0 0 28px rgba(255,20,147,.8))",
              }}
            />
          </div>
        )}

        <div className="absolute bottom-[112px] left-8 right-8 z-40 flex items-center gap-3">
          <div
            className="flex min-w-0 flex-1 items-center rounded-full px-7 py-[20px]"
            style={{
              background: "rgba(20,18,31,.90)",
              border: "2px solid transparent",
              backgroundImage: "linear-gradient(rgba(20,18,31,.92),rgba(20,18,31,.92)),linear-gradient(90deg,#FF1493,#8B5CF6,#008CFF)",
              backgroundOrigin: "border-box",
              backgroundClip: "padding-box,border-box",
              boxShadow: "0 0 18px rgba(255,20,147,.16), 0 0 22px rgba(0,140,255,.10)",
              backdropFilter: "blur(16px)",
            }}
          >
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to ${storyUser.displayName}...`}
              className="min-w-0 flex-1 bg-transparent text-[20px] font-medium text-white outline-none placeholder:text-white/55"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid="input-story-reply"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleReaction();
              }}
              className="ml-4 flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-[#34364b]/90"
              aria-label={liked ? "Unlike story" : "Like story"}
              data-testid="btn-story-heart"
            >
              <Heart
                size={26}
                strokeWidth={2}
                style={{
                  color: "#BFA8FF",
                  fill: liked ? "url(#yunikoHeartGradient)" : "transparent",
                }}
              />
              <svg width="0" height="0" aria-hidden="true">
                <defs>
                  <linearGradient id="yunikoHeartGradient" x1="0" x2="1">
                    <stop offset="0%" stopColor="#FF4CB4" />
                    <stop offset="100%" stopColor="#7DB8FF" />
                  </linearGradient>
                </defs>
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReplyText("");
              }}
              className="ml-2 flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-[#34364b]/90"
              aria-label="Send reply"
              data-testid="btn-send-reply"
            >
              <Send size={25} strokeWidth={2.2} style={{ color: "#B26CFF", filter: "drop-shadow(0 0 6px rgba(0,140,255,.45))" }} />
            </button>
          </div>
        </div>

        {currentStory.location && (
          <div
            className="absolute bottom-8 left-8 z-40 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[18px] font-semibold text-white"
            style={{
              border: "2px solid transparent",
              backgroundImage: "linear-gradient(rgba(20,18,31,.86),rgba(20,18,31,.86)),linear-gradient(90deg,#FF1493,#8B5CF6,#008CFF)",
              backgroundOrigin: "border-box",
              backgroundClip: "padding-box,border-box",
              boxShadow: "0 0 16px rgba(255,20,147,.14)",
              backdropFilter: "blur(12px)",
            }}
          >
            <MapPin size={20} strokeWidth={2} style={{ color: "#FF5BB7" }} />
            <span>{currentStory.location}</span>
          </div>
        )}
      </div>
    </div>
  );
}
