import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, UserPlus, Globe, ChevronDown, Bookmark, Share2, Flag, EyeOff, WifiOff, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { stories, getFeedWithAds } from "@/data/mockData";
import StoryAvatar from "@/components/StoryAvatar";
import PostCard from "@/components/PostCard";
import BottomNav from "@/components/BottomNav";
import { t } from "@/lib/i18n";

const HEADER_H = 56;
const STORIES_H = 78;
const NAV_H = 64;
const TOP_OFFSET = HEADER_H + STORIES_H;

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

const feedItems = getFeedWithAds();

export default function Home() {
  const [, setLocation] = useLocation();
  const [optionsPostId, setOptionsPostId] = useState<string | null>(null);
  const [worldFeedOpen, setWorldFeedOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="relative w-full max-w-[430px] mx-auto"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      {/* ── HEADER ── fixed */}
      <header
        className="absolute inset-x-0 top-0 z-50 flex items-center justify-between px-4"
        style={{
          height: HEADER_H,
          background: "rgba(10,8,18,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,61,154,0.1)",
        }}
        data-testid="home-header"
      >
        {/* Yuniko logo */}
        <button onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}>
          <span
            className="text-2xl font-black tracking-tight"
            style={{
              background: "linear-gradient(90deg, #FF3D9A 0%, #C026D3 50%, #8B00FF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Yuniko
          </span>
        </button>

        {/* World Feed pill */}
        <button
          onClick={() => setWorldFeedOpen((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,61,154,0.3)",
            boxShadow: "0 0 10px rgba(255,0,110,0.1)",
          }}
          data-testid="btn-world-feed"
        >
          <Globe size={13} style={{ color: "#FF3D9A" }} />
          <span className="text-white/90 text-sm font-medium">{t("worldFeed")}</span>
          <ChevronDown size={12} className="text-white/55" />
        </button>

        {/* Right icons */}
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => setLocation("/search")}>
            <Search size={21} className="text-white/75" strokeWidth={1.8} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => setLocation("/add-friends")}>
            <UserPlus size={21} className="text-white/75" strokeWidth={1.8} />
          </motion.button>
        </div>
      </header>

      {/* World Feed dropdown */}
      <AnimatePresence>
        {worldFeedOpen && (
          <>
            <motion.div
              key="wf-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40"
              onClick={() => setWorldFeedOpen(false)}
            />
            <motion.div
              key="wf-menu"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="absolute top-[60px] left-1/2 -translate-x-1/2 w-44 rounded-2xl z-50 overflow-hidden"
              style={{
                background: "rgba(18,14,30,0.98)",
                border: "1px solid rgba(255,61,154,0.25)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              {["World Feed", "Friends Feed", "Following"].map((item) => (
                <button
                  key={item}
                  onClick={() => setWorldFeedOpen(false)}
                  className="w-full px-4 py-3 text-left text-white/85 text-sm hover:bg-pink-500/15 flex items-center gap-2"
                >
                  <Globe size={13} style={{ color: "#FF3D9A" }} />
                  {item}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── STORIES ── fixed below header */}
      <div
        className="absolute inset-x-0 z-40"
        style={{
          top: HEADER_H,
          height: STORIES_H,
          background: "rgba(10,8,18,0.82)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
        data-testid="stories-row"
      >
        <div
          className="flex items-center gap-3 h-full px-4 overflow-x-auto no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <StoryAvatar userId="me" isOwn />
          {/* Go Live button */}
          <button
            onClick={() => setLocation("/live")}
            className="flex-shrink-0 flex flex-col items-center gap-1.5"
            data-testid="btn-go-live-stories"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center relative"
              style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 16px rgba(255,0,110,0.45)" }}
            >
              <Radio size={22} className="text-white" />
              <div
                className="absolute -top-0.5 -right-0.5 px-1 py-0.5 rounded-full text-[8px] font-bold text-white leading-none"
                style={{ background: "#FF006E" }}
              >
                LIVE
              </div>
            </div>
            <span className="text-white/60 text-[10px] font-medium">Go Live</span>
          </button>
          {stories.map((story) => (
            <StoryAvatar
              key={story.id}
              userId={story.userId}
              viewed={story.viewed}
            />
          ))}
        </div>
      </div>

      {/* ── OFFLINE BANNER ── */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute inset-x-0 z-30 flex items-center justify-center gap-1.5 py-1.5"
            style={{
              top: TOP_OFFSET,
              background: "rgba(239,68,68,0.88)",
              backdropFilter: "blur(8px)",
            }}
          >
            <WifiOff size={12} className="text-white" />
            <span className="text-white text-xs font-medium">Offline — showing cached posts</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── POSTS SNAP SCROLL ── */}
      <div
        ref={scrollRef}
        className="absolute inset-x-0 overflow-y-scroll"
        style={{
          top: TOP_OFFSET,
          bottom: NAV_H,
          scrollSnapType: "y mandatory",
          scrollSnapStop: "always",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
        }}
        data-testid="posts-feed"
      >
        {feedItems.map((post) => (
          <div
            key={post.id}
            className="relative px-2.5"
            style={{
              height: `calc(100dvh - ${TOP_OFFSET}px - ${NAV_H}px)`,
              scrollSnapAlign: "start",
              scrollSnapStop: "always",
              paddingBottom: 10,
              flexShrink: 0,
            }}
          >
            <div className="relative w-full h-full rounded-[20px] overflow-hidden"
              style={{
                boxShadow: post.isSponsored
                  ? "0 4px 24px rgba(255,0,110,0.18)"
                  : "0 2px 16px rgba(0,0,0,0.4)",
              }}
            >
              <PostCard
                post={post}
                onOptions={post.isSponsored ? undefined : () => setOptionsPostId(post.id)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM NAV ── */}
      <BottomNav />

      {/* ── POST OPTIONS SHEET ── */}
      <AnimatePresence>
        {optionsPostId && (
          <>
            <motion.div
              key="options-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/65"
              onClick={() => setOptionsPostId(null)}
            />
            <motion.div
              key="options-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 340 }}
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-2xl overflow-hidden"
              style={{
                background: "rgba(16,12,28,0.98)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="w-10 h-1 rounded-full bg-white/18 mx-auto mt-3 mb-4" />
              {[
                { icon: <Bookmark size={18} />, label: t("savePost") },
                { icon: <Share2 size={18} />, label: t("sharePost") },
                { icon: <EyeOff size={18} />, label: t("hide") },
                { icon: <Flag size={18} className="text-red-400" />, label: <span className="text-red-400">{t("report")}</span> },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => setOptionsPostId(null)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-white/85 text-sm font-medium"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => setOptionsPostId(null)}
                className="w-full py-4 text-white/45 text-sm font-medium"
              >
                {t("cancel")}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
