import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Heart, MessageCircle, Share2, Bookmark, BadgeCheck, MoreHorizontal, Sparkles, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Post, getUserById, formatCount } from "@/data/mockData";
import { t } from "@/lib/i18n";

interface PostCardProps {
  post: Post;
  onOptions?: () => void;
}

export default function PostCard({ post, onOptions }: PostCardProps) {
  const [, setLocation] = useLocation();
  const user = getUserById(post.userId);
  const [liked, setLiked] = useState(post.isLiked);
  const [saved, setSaved] = useState(post.isSaved);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [heartBurst, setHeartBurst] = useState(false);
  const [lastTap, setLastTap] = useState(0);

  if (!user) return null;

  const handleLike = useCallback(() => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  }, [liked]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap < 320) {
      if (!liked) {
        setLiked(true);
        setLikeCount((prev) => prev + 1);
      }
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 800);
    }
    setLastTap(now);
  }, [lastTap, liked]);

  return (
    <div className="relative w-full h-full" data-testid={`post-card-${post.id}`}>
      {/* Background image */}
      <img
        src={post.imageUrl}
        alt={post.caption}
        className="absolute inset-0 w-full h-full object-cover"
        onClick={handleDoubleTap}
        loading="lazy"
        decoding="async"
      />

      {/* Gradient overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.25) 45%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 18%)",
        }}
      />

      {/* Sponsored badge */}
      {post.isSponsored && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}>
          <Sparkles size={11} style={{ color: "#FF3D9A" }} />
          <span className="text-white/90 text-[11px] font-semibold tracking-wide">Sponsored</span>
        </div>
      )}

      {/* More options button */}
      {onOptions && !post.isSponsored && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          className="absolute top-3 right-3 p-2 rounded-full"
          style={{ background: "rgba(0,0,0,0.38)", backdropFilter: "blur(6px)" }}
          onClick={onOptions}
          data-testid="post-options-btn"
        >
          <MoreHorizontal size={18} className="text-white" />
        </motion.button>
      )}

      {/* Double-tap heart burst */}
      <AnimatePresence>
        {heartBurst && (
          <motion.div
            key="heart-burst"
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <Heart size={100} className="fill-red-500 text-red-500" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right action buttons */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-10">
        <ActionBtn
          icon={
            <Heart
              size={25}
              className={liked ? "fill-red-500 text-red-500" : "text-white"}
              strokeWidth={1.8}
            />
          }
          label={formatCount(likeCount)}
          onClick={handleLike}
          testId="btn-like"
          active={liked}
        />
        <ActionBtn
          icon={<MessageCircle size={25} className="text-white" strokeWidth={1.8} />}
          label={formatCount(post.comments)}
          onClick={() => setLocation(`/post/${post.id}`)}
          testId="btn-comment"
        />
        <ActionBtn
          icon={<Share2 size={25} className="text-white" strokeWidth={1.8} />}
          label={formatCount(post.shares)}
          onClick={() => {}}
          testId="btn-share"
        />
        <ActionBtn
          icon={
            <Bookmark
              size={25}
              className={saved ? "fill-yellow-400 text-yellow-400" : "text-white"}
              strokeWidth={1.8}
            />
          }
          label={formatCount(post.saves)}
          onClick={() => setSaved((prev) => !prev)}
          testId="btn-save"
          active={saved}
        />
      </div>

      {/* Bottom user info */}
      <div className="absolute bottom-4 left-3 right-20 z-10">
        <div className="flex items-center gap-2.5 mb-1.5">
          <button
            onClick={() => setLocation(`/user/${user.id}`)}
            className="flex-shrink-0"
          >
            <img
              src={user.avatar}
              alt={user.displayName}
              className="w-9 h-9 rounded-full object-cover"
              style={{
                boxShadow: "0 0 0 2px rgba(255,61,154,0.7)",
              }}
            />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setLocation(`/user/${user.id}`)}
                className="font-semibold text-white text-sm"
              >
                {user.displayName}
              </button>
              {user.verified && (
                <BadgeCheck size={13} className="text-blue-400 fill-blue-400 flex-shrink-0" />
              )}
              {post.location && (
                <span className="text-white/55 text-xs">· {post.location}</span>
              )}
            </div>
          </div>
          {!user.isFollowing && !post.isSponsored && (
            <motion.button
              whileTap={{ scale: 0.93 }}
              className="px-3.5 py-1 rounded-full text-xs font-semibold text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #FF006E, #8B00FF)",
                boxShadow: "0 2px 12px rgba(255,0,110,0.35)",
              }}
            >
              {t("follow")}
            </motion.button>
          )}
          {post.isSponsored && post.sponsorCta && (
            <motion.button
              whileTap={{ scale: 0.93 }}
              className="px-3 py-1 rounded-full text-xs font-semibold text-white flex-shrink-0 flex items-center gap-1"
              style={{
                background: "linear-gradient(135deg, #FF006E, #8B00FF)",
                boxShadow: "0 2px 12px rgba(255,0,110,0.35)",
              }}
            >
              <ExternalLink size={10} />
              {post.sponsorCta}
            </motion.button>
          )}
        </div>
        <p className="text-white text-sm font-medium leading-snug line-clamp-2">
          {post.caption}
        </p>
        {post.hashtags.length > 0 && (
          <p className="text-sm mt-0.5" style={{ color: "#FF3D9A" }}>
            {post.hashtags.slice(0, 3).join(" ")}
          </p>
        )}
        {!post.isSponsored && (
          <p className="text-white/40 text-xs mt-0.5">{post.timestamp}</p>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  testId,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  testId: string;
  active?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5"
      data-testid={testId}
      whileTap={{ scale: 0.85 }}
    >
      <motion.div
        className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.42)", backdropFilter: "blur(8px)" }}
        animate={active ? { boxShadow: "0 0 14px rgba(255,61,154,0.4)" } : { boxShadow: "none" }}
      >
        {icon}
      </motion.div>
      <span className="text-white text-[11px] font-medium">{label}</span>
    </motion.button>
  );
}
