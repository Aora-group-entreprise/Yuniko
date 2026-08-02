import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, Users, Heart, MessageCircle, Share2, Mic, MicOff, Video, VideoOff, Gift, Eye } from "lucide-react";
import { currentUser } from "@/data/mockData";
import { t } from "@/lib/i18n";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

const LIVE_COMMENTS = [
  { id: "lc1", user: "maya_art", text: "🔥 This is amazing!", color: "#FF3D9A" },
  { id: "lc2", user: "sam_dev", text: "Love the vibe!", color: "#B054FF" },
  { id: "lc3", user: "zoe_travels", text: "Watching from Paris 🇫🇷", color: "#FF6EB4" },
  { id: "lc4", user: "noah_music", text: "🎵 Keep going!", color: "#FF3D9A" },
  { id: "lc5", user: "sofia_lens", text: "Hi from Spain! 🇪🇸", color: "#B054FF" },
];

const GIFT_EMOJIS = ["🌹", "💎", "🚀", "⭐", "🎁", "🦋"];

interface FloatingHeart {
  id: number;
  x: number;
  emoji: string;
}

export default function Live() {
  const [, setLocation] = useLocation();
  const [isLive, setIsLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [duration, setDuration] = useState(0);
  const [comments, setComments] = useState(LIVE_COMMENTS.slice(0, 2));
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);
  const [giftShown, setGiftShown] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [heartId, setHeartId] = useState(0);

  useEffect(() => {
    if (!isLive) return;

    const viewerInterval = setInterval(() => {
      setViewers((v) => v + Math.floor(Math.random() * 5));
    }, 2000);

    const likeInterval = setInterval(() => {
      setLikes((l) => l + Math.floor(Math.random() * 8));
    }, 1500);

    const durationInterval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);

    const commentInterval = setInterval(() => {
      const pool = LIVE_COMMENTS;
      const random = pool[Math.floor(Math.random() * pool.length)];
      setComments((prev) => [...prev.slice(-5), { ...random, id: `${random.id}_${Date.now()}` }]);
    }, 3000);

    const heartInterval = setInterval(() => {
      addHeart("❤️");
    }, 2500);

    return () => {
      clearInterval(viewerInterval);
      clearInterval(likeInterval);
      clearInterval(durationInterval);
      clearInterval(commentInterval);
      clearInterval(heartInterval);
    };
  }, [isLive]);

  const addHeart = (emoji = "❤️") => {
    const id = heartId + 1;
    setHeartId(id);
    setFloatingHearts((prev) => [...prev, { id, x: 20 + Math.random() * 60, emoji }]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 2000);
  };

  const sendGift = (emoji: string) => {
    setGiftShown(emoji);
    addHeart(emoji);
    setTimeout(() => setGiftShown(null), 2000);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const sendComment = () => {
    if (!commentInput.trim()) return;
    setComments((prev) => [
      ...prev.slice(-5),
      { id: `me_${Date.now()}`, user: currentUser.username, text: commentInput, color: "#FF3D9A" },
    ]);
    setCommentInput("");
  };

  if (!isLive) {
    return (
      <div
        className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: "#0D0B14" }}
      >
        <button onClick={() => setLocation("/")} className="absolute top-5 left-4">
          <X size={24} className="text-white/70" />
        </button>

        <div
          className="w-32 h-32 rounded-full mb-6 flex items-center justify-center relative overflow-hidden"
          style={{ background: GRADIENT, boxShadow: "0 0 60px rgba(255,0,110,0.5)" }}
        >
          <Video size={48} className="text-white" />
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ border: "2px solid rgba(255,0,110,0.4)" }}
          />
        </div>

        <h1 className="text-white font-bold text-2xl mb-2">Go Live</h1>
        <p className="text-white/50 text-sm mb-8 text-center px-8">
          Start a live broadcast and connect with your followers in real time
        </p>

        <div className="flex gap-6 mb-10">
          <button
            onClick={() => setMicOn(!micOn)}
            className="flex flex-col items-center gap-2"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: micOn ? "rgba(255,255,255,0.1)" : "rgba(255,0,110,0.2)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {micOn ? <Mic size={22} className="text-white" /> : <MicOff size={22} style={{ color: "#FF3D9A" }} />}
            </div>
            <span className="text-white/50 text-xs">{micOn ? "Mic On" : "Muted"}</span>
          </button>

          <button
            onClick={() => setCamOn(!camOn)}
            className="flex flex-col items-center gap-2"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: camOn ? "rgba(255,255,255,0.1)" : "rgba(255,0,110,0.2)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {camOn ? <Video size={22} className="text-white" /> : <VideoOff size={22} style={{ color: "#FF3D9A" }} />}
            </div>
            <span className="text-white/50 text-xs">{camOn ? "Cam On" : "Off"}</span>
          </button>
        </div>

        <button
          onClick={() => { setIsLive(true); setViewers(12); setLikes(0); setDuration(0); }}
          className="px-10 py-4 rounded-2xl text-white font-bold text-lg"
          style={{ background: GRADIENT, boxShadow: "0 4px 24px rgba(255,0,110,0.5)" }}
          data-testid="btn-go-live"
        >
          🔴 Go Live
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-[430px] mx-auto min-h-screen relative overflow-hidden flex flex-col"
      style={{ background: "#0D0B14" }}
      data-testid="live-broadcast-screen"
    >
      {/* Camera preview background */}
      <img
        src={currentUser.coverPhoto}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: camOn ? 0.35 : 0.1, filter: "blur(2px)" }}
      />

      {/* Top gradient overlay */}
      <div
        className="absolute inset-x-0 top-0 h-36 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)" }}
      />

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-x-0 bottom-0 h-64 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)" }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-5 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <img src={currentUser.avatar} alt="" className="w-10 h-10 rounded-full object-cover" style={{ border: "2px solid #FF006E" }} />
            <div
              className="absolute -bottom-0.5 -right-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
              style={{ background: GRADIENT }}
            >
              LIVE
            </div>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{currentUser.displayName}</p>
            <p className="text-white/50 text-xs">{formatDuration(duration)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Eye size={13} className="text-white/60" />
            <span className="text-white text-xs font-semibold">{viewers.toLocaleString()}</span>
          </div>
          <button
            onClick={() => { setIsLive(false); setLocation("/"); }}
            className="px-3 py-1.5 rounded-full text-xs font-bold text-white"
            style={{ background: "#EF4444" }}
            data-testid="btn-end-live"
          >
            End
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative z-10 flex items-center gap-4 px-4 mb-auto">
        <div className="flex items-center gap-1">
          <Heart size={14} style={{ color: "#FF3D9A" }} />
          <span className="text-white/70 text-xs font-medium">{likes.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Users size={14} className="text-white/40" />
          <span className="text-white/50 text-xs">{viewers} {t("watching")}</span>
        </div>
      </div>

      {/* Floating hearts */}
      <div className="absolute bottom-28 left-0 right-0 h-64 pointer-events-none overflow-hidden">
        {floatingHearts.map((heart) => (
          <div
            key={heart.id}
            className="absolute text-2xl"
            style={{
              left: `${heart.x}%`,
              bottom: 0,
              animation: "floatUp 2s ease-out forwards",
            }}
          >
            {heart.emoji}
          </div>
        ))}
      </div>

      {/* Gift animation */}
      {giftShown && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div
            className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl"
            style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,0,110,0.4)" }}
          >
            <span className="text-5xl">{giftShown}</span>
            <span className="text-white/70 text-sm">Gift sent!</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="relative z-10 mt-auto">
        {/* Comments */}
        <div className="px-4 mb-3 flex flex-col gap-2">
          {comments.slice(-4).map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <span className="text-xs font-bold" style={{ color: c.color }}>@{c.user}</span>
              <span className="text-white/80 text-xs">{c.text}</span>
            </div>
          ))}
        </div>

        {/* Gifts row */}
        <div className="px-4 mb-3 flex items-center gap-3">
          <div className="flex items-center gap-1 text-white/50 text-xs">
            <Gift size={14} />
            <span>Gifts</span>
          </div>
          {GIFT_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendGift(emoji)}
              className="text-2xl hover:scale-125 transition-transform"
              data-testid={`btn-gift-${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex items-center gap-2 px-4 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendComment()}
              placeholder="Say something..."
              className="flex-1 bg-transparent text-white/85 text-sm outline-none placeholder:text-white/30"
              data-testid="input-live-comment"
            />
          </div>
          <button onClick={() => addHeart()} data-testid="btn-live-heart">
            <Heart size={24} style={{ color: "#FF3D9A" }} />
          </button>
          <button
            onClick={() => setMicOn(!micOn)}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: micOn ? "rgba(255,255,255,0.1)" : "rgba(255,0,110,0.2)" }}
            data-testid="btn-live-mic"
          >
            {micOn ? <Mic size={18} className="text-white" /> : <MicOff size={18} style={{ color: "#FF3D9A" }} />}
          </button>
          <button data-testid="btn-live-share">
            <Share2 size={22} className="text-white/50" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
