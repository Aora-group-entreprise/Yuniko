import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Heart, MessageCircle, Share2, Bookmark, BadgeCheck,
  MoreHorizontal, Sparkles, ExternalLink, X, Send, Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type Post } from "@/types/domain";
import { apiFetch } from "@/lib/api";
import { t } from "@/lib/i18n";

export interface LiveAuthor {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  verified?: boolean;
  isFollowing?: boolean;
}

interface Comment {
  id: number;
  text: string;
  createdAt: string;
  authorDisplayName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
}

interface PostCardProps {
  post: Post;
  onOptions?: () => void;
  liveAuthor?: LiveAuthor;
}

function dbId(postId: string | number): number | null {
  const raw = String(postId);
  if (raw.startsWith("live_")) {
    const n = parseInt(raw.slice(5), 10);
    return isNaN(n) ? null : n;
  }
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
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

export default function PostCard({ post, onOptions, liveAuthor }: PostCardProps) {
  const [, setLocation] = useLocation();
  const numericId = dbId(post.id);
  const formatCount = (count:number) => count >= 1_000_000 ? `${(count/1_000_000).toFixed(1)}M` : count >= 1_000 ? `${(count/1_000).toFixed(1)}K` : String(count);

  const author: LiveAuthor | null = liveAuthor ?? null;

  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [heartBurst, setHeartBurst] = useState(false);
  const lastTapRef = useRef(0);

  const handleLike = useCallback(() => {
    setLiked((prev) => {
      const next = !prev;
      setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
      if (numericId) {
        apiFetch(`/posts/${numericId}/like`, { method: "POST" })
          .then((r) => r.ok ? r.json() : null)
          .then((d) => { if (d?.post) setLikeCount(d.post.likes ?? likeCount); })
          .catch(() => {});
      }
      return next;
    });
  }, [numericId]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      setLiked((prev) => {
        if (!prev) {
          setLikeCount((c) => c + 1);
          if (numericId) {
            apiFetch(`/posts/${numericId}/like`, { method: "POST" }).catch(() => {});
          }
        }
        return true;
      });
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 800);
    }
    lastTapRef.current = now;
  }, [numericId]);

  const [saved, setSaved] = useState(post.isSaved);
  const [saveCount, setSaveCount] = useState(post.saves);
  const [shareCount, setShareCount] = useState(post.shares);
  const [viewCount, setViewCount] = useState((post as any).views ?? 0);

  useEffect(() => {
    if (!numericId) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      apiFetch(`/posts/${numericId}/view`, {
        method: "POST",
        body: JSON.stringify({ watchMs: Date.now() - startedAt, completionRate: 75 }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.post?.views != null) setViewCount(d.post.views); })
        .catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [numericId]);

  const toggleSave = useCallback(() => {
    const next = !saved;
    setSaved(next);
    setSaveCount((c) => next ? c + 1 : Math.max(0, c - 1));
    if (numericId) apiFetch(`/posts/${numericId}/save`, { method: "POST" }).then((r) => r.ok ? r.json() : null).then((d) => { if (d?.post) { setSaved(Boolean(d.active)); setSaveCount(d.post.saves ?? saveCount); } }).catch(() => {});
  }, [numericId, saveCount, saved]);

  const sharePost = useCallback(async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) await navigator.share({ title: `Yuniko post by ${author?.displayName}`, text: post.caption, url }).catch(() => undefined);
    else await navigator.clipboard?.writeText(url).catch(() => undefined);
    setShareCount((c) => c + 1);
    if (numericId) apiFetch(`/posts/${numericId}/share`, { method: "POST" }).then((r) => r.ok ? r.json() : null).then((d) => { if (d?.post?.shares != null) setShareCount(d.post.shares); }).catch(() => {});
  }, [author?.displayName, numericId, post.caption, post.id]);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [submitting, setSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const openComments = useCallback(async () => {
    setShowComments(true);
    if (!numericId) return;
    setCommentsLoading(true);
    try {
      const res = await apiFetch(`/posts/${numericId}/comments`);
      const data = await res.json() as { comments?: Comment[] };
      setComments(data.comments ?? []);
    } catch {
      /* ignore */
    } finally {
      setCommentsLoading(false);
    }
    setTimeout(() => commentInputRef.current?.focus(), 350);
  }, [numericId]);

  const submitComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text || !numericId || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/posts/${numericId}/comments`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json() as { comment?: Comment };
        if (data.comment) {
          setComments((prev) => [data.comment!, ...prev]);
          setCommentCount((c) => c + 1);
        }
        setCommentText("");
      }
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  }, [commentText, numericId, submitting]);

  if (!author) return null;

  const avatarSrc =
    author.avatarUrl ??
    `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(author.displayName)}&backgroundColor=FF006E`;

  return (
    <div className="relative w-full h-full" data-testid={`post-card-${post.id}`}>
      {(post as any).mediaType === "text" || !post.imageUrl ? (
        <div className="absolute inset-0 flex items-center justify-center p-8" onClick={handleDoubleTap} style={{ background: "linear-gradient(145deg, #160b22 0%, #301141 48%, #090710 100%)" }}>
          <p className="text-white text-2xl font-black leading-tight text-center">{post.caption}</p>
        </div>
      ) : (post as any).mediaType === "video" ? (
        <video src={post.imageUrl} className="absolute inset-0 w-full h-full object-cover" onClick={handleDoubleTap} autoPlay muted loop playsInline />
      ) : (Array.isArray((post as any).mediaItems) && (post as any).mediaItems.length > 1) ? (
        <div className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar" onClick={handleDoubleTap}>
          {(post as any).mediaItems.map((src: string, i: number) => <img key={src + i} src={src} alt={`${post.caption} ${i + 1}`} className="w-full h-full object-cover flex-shrink-0 snap-center" loading="lazy" decoding="async" />)}
        </div>
      ) : (
        <img src={post.imageUrl} alt={post.caption} className="absolute inset-0 w-full h-full object-cover" onClick={handleDoubleTap} loading="lazy" decoding="async" />
      )}

      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.25) 45%, transparent 70%)" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 18%)" }} />

      {post.isSponsored && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)" }}>
          <Sparkles size={11} style={{ color: "#FF3D9A" }} />
          <span className="text-white/90 text-[11px] font-semibold tracking-wide">Sponsored</span>
        </div>
      )}

      {onOptions && !post.isSponsored && (
        <motion.button whileTap={{ scale: 0.88 }} className="absolute top-3 right-3 p-2 rounded-full" style={{ background: "rgba(0,0,0,0.38)", backdropFilter: "blur(6px)" }} onClick={onOptions} data-testid="post-options-btn">
          <MoreHorizontal size={18} className="text-white" />
        </motion.button>
      )}

      <AnimatePresence>
        {heartBurst && (
          <motion.div key="heart-burst" initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 1.6, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <Heart size={100} className="fill-red-500 text-red-500" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-10">
        <ActionBtn icon={<Heart size={25} className={liked ? "fill-red-500 text-red-500" : "text-white"} strokeWidth={1.8} />} label={formatCount(likeCount)} onClick={handleLike} testId="btn-like" active={liked} />
        <ActionBtn icon={<MessageCircle size={25} className="text-white" strokeWidth={1.8} />} label={formatCount(commentCount)} onClick={openComments} testId="btn-comment" />
        <ActionBtn icon={<Share2 size={25} className="text-white" strokeWidth={1.8} />} label={formatCount(shareCount)} onClick={sharePost} testId="btn-share" />
        <ActionBtn icon={<Bookmark size={25} className={saved ? "fill-yellow-400 text-yellow-400" : "text-white"} strokeWidth={1.8} />} label={formatCount(saveCount)} onClick={toggleSave} testId="btn-save" active={saved} />
      </div>

      <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.38)", backdropFilter: "blur(8px)" }}>
        <Eye size={12} className="text-white/75" />
        <span className="text-white/80 text-[11px] font-semibold">{formatCount(viewCount)}</span>
      </div>

      <div className="absolute bottom-4 left-3 right-20 z-10">
        <div className="flex items-center gap-2.5 mb-1.5">
          <button onClick={() => setLocation(`/user/${post.userId}`)} className="flex-shrink-0">
            <img src={avatarSrc} alt={author.displayName} className="w-9 h-9 rounded-full object-cover" style={{ boxShadow: "0 0 0 2px rgba(255,61,154,0.7)" }} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <button onClick={() => setLocation(`/user/${post.userId}`)} className="font-semibold text-white text-sm">{author.displayName}</button>
              {author.verified && <BadgeCheck size={13} className="text-blue-400 fill-blue-400 flex-shrink-0" />}
              {post.location && <span className="text-white/55 text-xs">· {post.location}</span>}
            </div>
          </div>
          {!author.isFollowing && !post.isSponsored && (
            <motion.button whileTap={{ scale: 0.93 }} className="px-3.5 py-1 rounded-full text-xs font-semibold text-white flex-shrink-0" style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 2px 12px rgba(255,0,110,0.35)" }}>
              {t("follow")}
            </motion.button>
          )}
          {post.isSponsored && post.sponsorCta && (
            <motion.button whileTap={{ scale: 0.93 }} className="px-3 py-1 rounded-full text-xs font-semibold text-white flex-shrink-0 flex items-center gap-1" style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 2px 12px rgba(255,0,110,0.35)" }}>
              <ExternalLink size={10} />
              {post.sponsorCta}
            </motion.button>
          )}
        </div>
        <p className="text-white text-sm font-medium leading-snug line-clamp-2">{post.caption}</p>
        {post.hashtags.length > 0 && <p className="text-sm mt-0.5" style={{ color: "#FF3D9A" }}>{post.hashtags.slice(0, 3).join(" ")}</p>}
        {!post.isSponsored && <p className="text-white/40 text-xs mt-0.5">{post.timestamp}</p>}
      </div>

      <AnimatePresence>
        {showComments && (
          <>
            <motion.div key="comments-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black/60" onClick={() => setShowComments(false)} />
            <motion.div key="comments-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 340 }} className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[61] rounded-t-3xl flex flex-col" style={{ maxHeight: "72vh", background: "rgba(14,11,24,0.98)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-0 flex-shrink-0" />
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-white font-semibold text-sm">Comments{commentCount > 0 ? ` (${commentCount})` : ""}</span>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => setShowComments(false)}><X size={18} className="text-white/60" /></motion.button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
                {commentsLoading && <div className="flex justify-center py-6"><div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-pink-500 animate-spin" /></div>}
                {!commentsLoading && comments.length === 0 && <div className="text-center py-8 text-white/35 text-sm">{numericId ? "No comments yet. Be the first!" : "Comments not available for this post."}</div>}
                {comments.map((c) => {
                  const cAvatar = c.authorAvatarUrl ?? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(c.authorDisplayName)}&backgroundColor=8B00FF`;
                  return (
                    <div key={c.id} className="flex gap-3">
                      <img src={cAvatar} alt={c.authorDisplayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5"><span className="text-white text-xs font-semibold">{c.authorDisplayName}</span><span className="text-white/35 text-[10px]">{relativeTime(c.createdAt)}</span></div>
                        <p className="text-white/80 text-sm leading-snug">{c.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {numericId && (
                <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingBottom: "env(safe-area-inset-bottom, 12px)" }}>
                  <input ref={commentInputRef} value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitComment()} placeholder="Add a comment…" className="flex-1 bg-white/6 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/35 outline-none" style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                  <motion.button whileTap={{ scale: 0.88 }} onClick={submitComment} disabled={!commentText.trim() || submitting} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: commentText.trim() ? "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)" : "rgba(255,255,255,0.08)" }}>
                    {submitting ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Send size={15} className="text-white" />}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, testId, active }: { icon: React.ReactNode; label: string; onClick: () => void; testId: string; active?: boolean; }) {
  return (
    <motion.button onClick={onClick} className="flex flex-col items-center gap-0.5" data-testid={testId} whileTap={{ scale: 0.85 }}>
      <motion.div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.42)", backdropFilter: "blur(8px)" }} animate={active ? { boxShadow: "0 0 14px rgba(255,61,154,0.4)" } : { boxShadow: "none" }}>
        {icon}
      </motion.div>
      <span className="text-white text-[11px] font-medium">{label}</span>
    </motion.button>
  );
}
