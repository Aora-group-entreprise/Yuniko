import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { X, Image as ImageIcon, Video, MapPin, Hash, Globe, Layers, AlertCircle, Camera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

// Compress & crop uploaded image to max 1080px wide, JPEG 0.82
async function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1080;
        const scale = img.width > MAX ? MAX / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas error")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

type TabMode = "post" | "story";

export default function Create() {
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();

  // Detect ?mode=story from URL
  const [activeTab, setActiveTab] = useState<TabMode>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("mode");
      return p === "story" ? "story" : "post";
    }
    return "post";
  });

  const [caption, setCaption] = useState("");
  const [isWorldFeed, setIsWorldFeed] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [locationText, setLocationText] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [posted, setPosted] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync tab when URL param changes (e.g. navigated with ?mode=story)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("mode");
    setActiveTab(p === "story" ? "story" : "post");
  }, []);

  const avatarSrc =
    user?.avatarUrl ??
    `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user?.displayName ?? "U")}&backgroundColor=FF006E`;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processImage(file);
      setSelectedMedia(dataUrl);
      setError("");
    } catch {
      setError("Could not process image. Please try another.");
    }
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (activeTab === "story") {
      if (!selectedMedia) { setError("Please add a photo for your story"); return; }
    } else {
      if (!caption.trim() && !selectedMedia) { setError("Add a caption or photo"); return; }
    }

    if (!token) { setError("Please log in first"); return; }

    setLoading(true);
    setError("");
    try {
      if (activeTab === "story") {
        const r = await fetch("/api/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mediaUrl: selectedMedia, caption: caption.trim() }),
        });
        const d = await r.json() as { story?: any; error?: string };
        if (!r.ok) { setError(d.error ?? "Failed to post story"); return; }
      } else {
        const r = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            caption: caption.trim(),
            mediaUrl: selectedMedia,
            location: locationText.trim() || undefined,
            hashtags: hashtags.trim() || undefined,
            isWorldFeed,
          }),
        });
        const d = await r.json() as { post?: any; error?: string };
        if (!r.ok) { setError(d.error ?? "Failed to post"); return; }
      }
      setPosted(true);
      setTimeout(() => setLocation("/"), 1400);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (posted) {
    return (
      <div
        className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-5"
        style={{ background: "hsl(250, 30%, 7%)" }}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 18, stiffness: 280 }}
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: GRADIENT, boxShadow: "0 0 50px rgba(255,0,110,0.4)" }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-white font-semibold text-xl"
        >
          {activeTab === "story" ? "Story posted!" : "Posted!"}
        </motion.p>
      </div>
    );
  }

  const canSubmit = activeTab === "story" ? !!selectedMedia : !!(caption.trim() || selectedMedia);

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen pb-24" style={{ background: "hsl(250, 30%, 7%)" }}>
      {/* Hidden file input — opens camera/gallery on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 pt-4 pb-0 flex flex-col gap-0"
        style={{
          background: "rgba(10,8,18,0.96)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center justify-between pb-3">
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => setLocation("/")}>
            <X size={22} className="text-white/80" />
          </motion.button>
          <h1 className="text-base font-semibold text-white">
            {activeTab === "story" ? "New Story" : t("newPost")}
          </h1>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className="px-4 py-1.5 rounded-full text-sm font-semibold text-white"
            style={{
              background: canSubmit ? GRADIENT : "rgba(255,255,255,0.1)",
              opacity: loading ? 0.75 : canSubmit ? 1 : 0.5,
              boxShadow: canSubmit ? "0 2px 12px rgba(255,0,110,0.35)" : "none",
            }}
          >
            {loading
              ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : activeTab === "story" ? "Share" : t("postButton")}
          </motion.button>
        </div>

        {/* Post / Story tabs */}
        <div className="flex border-b border-white/8">
          {(["post", "story"] as TabMode[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setError(""); }}
              className="flex-1 pb-2.5 text-sm font-semibold capitalize relative"
              style={{ color: activeTab === tab ? "white" : "rgba(255,255,255,0.4)" }}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full"
                  style={{ background: GRADIENT }}
                />
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-4">
        {/* User row + caption */}
        <div className="flex gap-3 mb-4">
          <img
            src={avatarSrc}
            alt={user?.username ?? ""}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            style={{ boxShadow: "0 0 0 2px rgba(255,61,154,0.5)" }}
          />
          <div className="flex-1">
            <p className="text-white font-semibold text-sm mb-1.5">{user?.username ?? ""}</p>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={activeTab === "story" ? "Add a caption (optional)" : t("addCaption")}
              className="w-full bg-transparent text-white/85 text-sm resize-none outline-none placeholder:text-white/30"
              rows={activeTab === "story" ? 2 : 4}
            />
          </div>
        </div>

        {/* Selected media preview */}
        <AnimatePresence>
          {selectedMedia && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative mb-4 rounded-2xl overflow-hidden"
            >
              <img src={selectedMedia} alt="Selected" className="w-full rounded-2xl" />
              <button
                onClick={() => setSelectedMedia(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/65 flex items-center justify-center"
              >
                <X size={14} className="text-white" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Media buttons */}
        <div className="flex gap-3 mb-6">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-4 rounded-2xl flex flex-col items-center gap-2"
            style={{ background: "rgba(255,0,110,0.08)", border: "1px solid rgba(255,0,110,0.25)" }}
          >
            <Camera size={24} style={{ color: "#FF3D9A" }} />
            <span className="text-white/70 text-xs font-medium">
              {selectedMedia ? "Change Photo" : "Add Photo"}
            </span>
          </motion.button>
          {activeTab === "post" && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowVideoModal(true)}
              className="flex-1 py-4 rounded-2xl flex flex-col items-center gap-2"
              style={{ background: "rgba(139,0,255,0.08)", border: "1px solid rgba(139,0,255,0.25)" }}
            >
              <Video size={24} style={{ color: "#B060FF" }} />
              <span className="text-white/70 text-xs font-medium">{t("video")}</span>
            </motion.button>
          )}
        </div>

        {/* Post-only options */}
        {activeTab === "post" && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <MapPin size={18} className="text-pink-400 flex-shrink-0" />
              <input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder={t("location")}
                className="flex-1 bg-transparent text-white/80 text-sm outline-none placeholder:text-white/30"
              />
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <Hash size={18} className="text-blue-400 flex-shrink-0" />
              <input
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder={t("hashtags")}
                className="flex-1 bg-transparent text-white/80 text-sm outline-none placeholder:text-white/30"
              />
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Globe size={18} style={{ color: "#FF3D9A" }} className="flex-shrink-0" />
              <span className="flex-1 text-white/80 text-sm">{t("worldFeed")}</span>
              <Toggle value={isWorldFeed} onChange={setIsWorldFeed} />
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs text-center mt-4">{error}</p>
        )}
      </div>

      <BottomNav />

      {/* Video not available modal */}
      <AnimatePresence>
        {showVideoModal && (
          <>
            <motion.div
              key="video-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70"
              onClick={() => setShowVideoModal(false)}
            />
            <motion.div
              key="video-modal"
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 20 }}
              transition={{ type: "spring", damping: 22, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 z-50 rounded-3xl p-6 text-center"
              style={{ background: "rgba(16,12,28,0.98)", border: "1px solid rgba(255,61,154,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(255,0,110,0.12)", border: "1px solid rgba(255,0,110,0.25)" }}>
                <AlertCircle size={28} style={{ color: "#FF3D9A" }} />
              </div>
              <h3 className="text-white font-bold text-base mb-2">Not Available Yet</h3>
              <p className="text-white/55 text-sm leading-relaxed mb-5">
                Video uploads are coming soon. Stay tuned! 🎬
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowVideoModal(false)}
                className="w-full py-3 rounded-2xl text-white font-semibold text-sm"
                style={{ background: GRADIENT }}
              >
                Got it
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <motion.button
      onClick={() => onChange(!value)}
      className="relative w-10 h-6 rounded-full flex-shrink-0"
      style={{ background: value ? GRADIENT : "rgba(255,255,255,0.15)" }}
    >
      <motion.span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
        animate={{ left: value ? "calc(100% - 22px)" : "2px" }}
        transition={{ type: "spring", damping: 22, stiffness: 400 }}
      />
    </motion.button>
  );
}
