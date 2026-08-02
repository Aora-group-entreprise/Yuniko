import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { X, Send, MoreHorizontal, BadgeCheck } from "lucide-react";
import { stories, getUserById } from "@/data/mockData";
import { t } from "@/lib/i18n";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👏"];

export default function StoryViewer() {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "u1";
  const user = getUserById(userId);
  const userStories = stories.filter((s) => s.userId === userId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [reactionShown, setReactionShown] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const STORY_DURATION = 5000;

  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < userStories.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          } else {
            setLocation("/");
            return 100;
          }
        }
        return prev + 100 / (STORY_DURATION / 100);
      });
    }, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentIndex, paused, userStories.length]);

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

  const handleReaction = (emoji: string) => {
    setReactionShown(emoji);
    setTimeout(() => setReactionShown(null), 1500);
  };

  if (!user || userStories.length === 0) {
    return (
      <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex items-center justify-center">
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
      className="w-full max-w-[430px] mx-auto min-h-screen relative overflow-hidden"
      style={{ background: "#000" }}
      data-testid="story-viewer"
    >
      {/* Story image */}
      <img
        src={currentStory.imageUrl}
        alt="Story"
        className="absolute inset-0 w-full h-full object-cover"
        onClick={goNext}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
      />

      {/* Dark gradient top */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
      />

      {/* Progress bars */}
      <div className="absolute top-4 left-3 right-3 flex gap-1" data-testid="story-progress">
        {userStories.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.3)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: i < currentIndex ? "100%" : i === currentIndex ? `${progress}%` : "0%",
                background: "rgba(255,255,255,0.9)",
                transition: "width 0.1s linear",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-10 left-3 right-3 flex items-center justify-between">
        <button
          onClick={() => setLocation(`/user/${user.id}`)}
          className="flex items-center gap-2"
          data-testid="btn-story-user"
        >
          <img
            src={user.avatar}
            alt={user.displayName}
            className="w-9 h-9 rounded-full object-cover"
            style={{ border: "2px solid rgba(255,0,110,0.8)" }}
          />
          <div>
            <div className="flex items-center gap-1">
              <span className="text-white font-semibold text-sm">{user.displayName}</span>
              {user.verified && <BadgeCheck size={13} className="text-blue-300 fill-blue-300" />}
            </div>
            <span className="text-white/60 text-xs">{currentStory.timestamp} {t("ago")}</span>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <button data-testid="btn-story-options">
            <MoreHorizontal size={22} className="text-white" />
          </button>
          <button onClick={() => setLocation("/")} data-testid="btn-close-story">
            <X size={22} className="text-white" />
          </button>
        </div>
      </div>

      {/* Tap zones */}
      <div className="absolute inset-0 flex">
        <div className="flex-1" onClick={goPrev} />
        <div className="flex-1" onClick={goNext} />
      </div>

      {/* Reaction popup */}
      {reactionShown && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="text-7xl animate-bounce"
            style={{ filter: "drop-shadow(0 0 20px rgba(255,0,110,0.8))" }}
          >
            {reactionShown}
          </span>
        </div>
      )}

      {/* Dark gradient bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }}
      />

      {/* Quick reactions */}
      <div className="absolute bottom-24 left-3 right-3 flex justify-center gap-3">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={(e) => {
              e.stopPropagation();
              handleReaction(emoji);
            }}
            className="text-2xl p-1 rounded-full hover:scale-125 transition-transform"
            style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}
            data-testid={`reaction-${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Reply input */}
      <div className="absolute bottom-6 left-3 right-3 flex items-center gap-2">
        <div
          className="flex-1 flex items-center px-4 py-2.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(12px)" }}
        >
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`Reply to ${user.displayName}...`}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/50"
            onClick={(e) => e.stopPropagation()}
            data-testid="input-story-reply"
          />
        </div>
        {replyText && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setReplyText("");
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 2px 10px rgba(255,0,110,0.4)" }}
            data-testid="btn-send-reply"
          >
            <Send size={16} className="text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
