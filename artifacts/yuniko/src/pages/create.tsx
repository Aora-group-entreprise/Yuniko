import { useState } from "react";
import { useLocation } from "wouter";
import { X, Image, Video, MapPin, Hash, Globe, Layers, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { t } from "@/lib/i18n";
import { currentUser } from "@/data/mockData";
import BottomNav from "@/components/BottomNav";

export default function Create() {
  const [, setLocation] = useLocation();
  const [caption, setCaption] = useState("");
  const [isWorldFeed, setIsWorldFeed] = useState(true);
  const [isAddToStory, setIsAddToStory] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [locationText, setLocationText] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [posted, setPosted] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const handlePost = () => {
    if (!caption && !selectedMedia) return;
    setPosted(true);
    setTimeout(() => setLocation("/"), 1400);
  };

  if (posted) {
    return (
      <div className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-5"
        style={{ background: "hsl(250, 30%, 7%)" }}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 18, stiffness: 280 }}
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 50px rgba(255,0,110,0.4)" }}
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
          Posted!
        </motion.p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen pb-24"
      style={{ background: "hsl(250, 30%, 7%)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center justify-between"
        style={{
          background: "rgba(10,8,18,0.96)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="create-header"
      >
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => setLocation("/")} data-testid="btn-close-create">
          <X size={22} className="text-white/80" />
        </motion.button>
        <h1 className="text-base font-semibold text-white">{t("newPost")}</h1>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handlePost}
          className="px-4 py-1.5 rounded-full text-sm font-semibold text-white"
          style={{
            background: caption || selectedMedia
              ? "linear-gradient(135deg, #FF006E, #8B00FF)"
              : "rgba(255,255,255,0.1)",
            opacity: caption || selectedMedia ? 1 : 0.5,
            boxShadow: caption || selectedMedia ? "0 2px 12px rgba(255,0,110,0.35)" : "none",
          }}
          data-testid="btn-post"
        >
          {t("postButton")}
        </motion.button>
      </header>

      <div className="px-4 py-4">
        {/* User row + caption */}
        <div className="flex gap-3 mb-4">
          <img
            src={currentUser.avatar}
            alt={currentUser.displayName}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            style={{ boxShadow: "0 0 0 2px rgba(255,61,154,0.5)" }}
          />
          <div className="flex-1">
            <p className="text-white font-semibold text-sm mb-1.5">{currentUser.username}</p>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("addCaption")}
              className="w-full bg-transparent text-white/85 text-sm resize-none outline-none placeholder:text-white/30"
              rows={4}
              data-testid="input-caption"
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

        {/* Media options */}
        <div className="flex gap-3 mb-6">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedMedia(`https://picsum.photos/seed/${Date.now()}/600/400`)}
            className="flex-1 py-4 rounded-2xl flex flex-col items-center gap-2"
            style={{ background: "rgba(255,0,110,0.08)", border: "1px solid rgba(255,0,110,0.25)" }}
            data-testid="btn-add-photo"
          >
            <Image size={24} style={{ color: "#FF3D9A" }} />
            <span className="text-white/70 text-xs font-medium">{t("photo")}</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowVideoModal(true)}
            className="flex-1 py-4 rounded-2xl flex flex-col items-center gap-2"
            style={{ background: "rgba(139,0,255,0.08)", border: "1px solid rgba(139,0,255,0.25)" }}
            data-testid="btn-add-video"
          >
            <Video size={24} style={{ color: "#B060FF" }} />
            <span className="text-white/70 text-xs font-medium">{t("video")}</span>
          </motion.button>
        </div>

        {/* Options */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <MapPin size={18} className="text-pink-400 flex-shrink-0" />
            <input
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder={t("location")}
              className="flex-1 bg-transparent text-white/80 text-sm outline-none placeholder:text-white/30"
              data-testid="input-location"
            />
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <Hash size={18} className="text-blue-400 flex-shrink-0" />
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder={t("hashtags")}
              className="flex-1 bg-transparent text-white/80 text-sm outline-none placeholder:text-white/30"
              data-testid="input-hashtags"
            />
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <Globe size={18} style={{ color: "#FF3D9A" }} className="flex-shrink-0" />
            <span className="flex-1 text-white/80 text-sm">{t("worldFeed")}</span>
            <Toggle value={isWorldFeed} onChange={setIsWorldFeed} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Layers size={18} style={{ color: "#B060FF" }} className="flex-shrink-0" />
            <span className="flex-1 text-white/80 text-sm">{t("addToStory")}</span>
            <Toggle value={isAddToStory} onChange={setIsAddToStory} />
          </div>
        </div>
      </div>

      <BottomNav />

      {/* Video not available modal */}
      <AnimatePresence>
        {showVideoModal && (
          <>
            <motion.div
              key="video-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
              style={{
                background: "rgba(16,12,28,0.98)",
                border: "1px solid rgba(255,61,154,0.25)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
              }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(255,0,110,0.12)", border: "1px solid rgba(255,0,110,0.25)" }}
              >
                <AlertCircle size={28} style={{ color: "#FF3D9A" }} />
              </div>
              <h3 className="text-white font-bold text-base mb-2">Not Available Yet</h3>
              <p className="text-white/55 text-sm leading-relaxed mb-5">
                Video uploads are coming soon. Stay tuned for updates! 🎬
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowVideoModal(false)}
                className="w-full py-3 rounded-2xl text-white font-semibold text-sm"
                style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)" }}
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
      style={{ background: value ? "linear-gradient(135deg, #FF006E, #8B00FF)" : "rgba(255,255,255,0.15)" }}
      data-testid="toggle-btn"
    >
      <motion.span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
        animate={{ left: value ? "calc(100% - 22px)" : "2px" }}
        transition={{ type: "spring", damping: 22, stiffness: 400 }}
      />
    </motion.button>
  );
}
