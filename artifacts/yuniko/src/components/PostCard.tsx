import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Heart, MessageCircle, Share2, Bookmark, BadgeCheck, MoreHorizontal, MoreVertical, Sparkles, ExternalLink, X, Send, Download, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Post, getUserById, formatCount } from "@/data/mockData";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api";

export interface LiveAuthor {
  userId?: number;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  verified?: boolean;
  isFollowing?: boolean;
}

interface PostCardProps {
  post: Post;
  onOptions?: () => void;
  liveAuthor?: LiveAuthor;
  initialViewer?: boolean;
  onViewerClose?: () => void;
}

export default function PostCard({ post, onOptions, liveAuthor, initialViewer = false, onViewerClose }: PostCardProps) {
  const [, setLocation] = useLocation();
  const { user: authUser } = useAuth();
  const mockUser = !liveAuthor ? getUserById(post.userId) : null;

  // Resolve author from liveAuthor prop or fall back to mock data
  const author: LiveAuthor | null = liveAuthor ?? (
    mockUser
      ? {
          displayName: mockUser.displayName,
          username: (mockUser as any).username ?? mockUser.displayName,
          avatarUrl: mockUser.avatar,
          verified: mockUser.verified,
          isFollowing: mockUser.isFollowing,
        }
      : null
  );

  const [liked, setLiked] = useState(post.isLiked);
  const [saved, setSaved] = useState(post.isSaved);
  const [following, setFollowing] = useState(Boolean(author?.isFollowing));
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    setFollowing(Boolean(author?.isFollowing));
  }, [author?.userId, author?.isFollowing]);

  const isOwnPost = Boolean(
    authUser?.id &&
    author?.userId &&
    Number(authUser.id) === Number(author.userId),
  );
  const [likeCount, setLikeCount] = useState(post.likes);
  const [heartBurst, setHeartBurst] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(initialViewer);
  const [viewerOptionsOpen, setViewerOptionsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Array<{
    id: string;
    userId: string;
    text: string;
    displayName: string;
    avatar: string;
    likes: number;
    liked: boolean;
    timestamp: string;
  }>>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const livePostId = post.id.startsWith("live_") ? post.id.slice("live_".length) : null;
  useEffect(() => {
    if (!livePostId) return;
    void apiJson(`/analytics/post/${livePostId}/impression`, { method: "POST" }).catch(() => {});
  }, [livePostId]);

  if (!author) return null;

  const avatarSrc =
    author.avatarUrl ??
    `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(author.displayName)}&backgroundColor=FF006E`;

  const handleLike = useCallback(async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((prev) => Math.max(0, prev + (nextLiked ? 1 : -1)));
    if (!livePostId) return;

    try {
      const result = await apiJson<{ liked: boolean; likes: number }>(
        `/posts/${livePostId}/like`,
        { method: "POST" },
      );
      setLiked(result.liked);
      setLikeCount(result.likes);
    } catch {
      setLiked(liked);
      setLikeCount((prev) => Math.max(0, prev + (nextLiked ? -1 : 1)));
    }
  }, [liked, livePostId]);

  const handleFollow = useCallback(async () => {
    if (!author?.userId || followLoading) return;
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    setFollowLoading(true);
    try {
      const result = await apiJson<{ following: boolean }>(
        "/users/" + author.userId + "/follow",
        { method: "POST" },
      );
      setFollowing(Boolean(result.following));
    } catch {
      setFollowing(following);
    } finally {
      setFollowLoading(false);
    }
  }, [author?.userId, followLoading, following]);

  const handleSave = useCallback(async () => {
    const nextSaved = !saved;
    setSaved(nextSaved);
    if (!livePostId) return;

    try {
      const result = await apiJson<{ saved: boolean; saves: number }>(
        `/posts/${livePostId}/save`,
        { method: "POST" },
      );
      setSaved(result.saved);
      window.dispatchEvent(new CustomEvent("yuniko:save-changed"));
    } catch {
      setSaved(saved);
    }
  }, [livePostId, saved]);

  const downloadImage = useCallback(async () => {
    try {
      const response = await fetch(post.imageUrl, { mode: "cors" });
      if (!response.ok) throw new Error("Image download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `yuniko-${post.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      const link = document.createElement("a");
      link.href = post.imageUrl;
      link.download = `yuniko-${post.id}.jpg`;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setViewerOptionsOpen(false);
    }
  }, [post.id, post.imageUrl]);

  const openViewer = useCallback(() => {
    const supportsViewer =
      typeof window !== "undefined" &&
      typeof window.CSS !== "undefined" &&
      typeof window.CSS.supports === "function" &&
      window.CSS.supports("position", "fixed");

    if (!supportsViewer) {
      setLocation(`/post/${post.id}`);
      return;
    }

    setViewerOpen(true);
  }, [post.id, setLocation]);

  const handleImageTap = useCallback(() => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      if (!liked) void handleLike();
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 800);
      return;
    }

    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      openViewer();
    }, 200);
  }, [handleLike, liked, openViewer]);

  const openComments = useCallback(async (fromViewer = false) => {
    const supportsSheet =
      typeof window !== "undefined" &&
      typeof window.CSS !== "undefined" &&
      typeof window.CSS.supports === "function" &&
      window.CSS.supports("position", "fixed");

    if (!supportsSheet) {
      setLocation(`/post/${post.id}?comments=1`);
      return;
    }

    if (fromViewer) setViewerOpen(true);
    setCommentsOpen(true);

    if (!livePostId || comments.length > 0) return;

    setCommentsLoading(true);
    try {
      const data = await apiJson<{ comments?: Array<any> }>(`/posts/${livePostId}/comments`);
      setComments((data.comments ?? []).map((comment) => ({
        id: String(comment.id),
        userId: String(comment.userId),
        text: comment.text ?? "",
        displayName: comment.displayName ?? "User",
        avatar:
          comment.avatarUrl ??
          `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(comment.displayName ?? "User")}&backgroundColor=FF006E`,
        likes: Number(comment.likes ?? 0),
        liked: Boolean(comment.liked),
        timestamp: comment.createdAt
          ? new Date(comment.createdAt).toLocaleDateString()
          : "",
      })));
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [comments.length, livePostId, post.id, setLocation]);

  const submitComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text) return;

    if (livePostId) {
      try {
        await apiJson(`/posts/${livePostId}/comments`, {
          method: "POST",
          body: JSON.stringify({ text }),
        });
      } catch {
        return;
      }
    }

    setComments((prev) => [
      ...prev,
      {
        id: `local_${Date.now()}`,
        userId: "me",
        text,
        displayName: "You",
        avatar: `https://api.dicebear.com/8.x/initials/svg?seed=You&backgroundColor=FF006E`,
        likes: 0,
        liked: false,
        timestamp: "just now",
      },
    ]);
    setCommentText("");
  }, [commentText, livePostId]);

  const toggleCommentLike = useCallback((id: string) => {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === id
          ? {
              ...comment,
              liked: !comment.liked,
              likes: Math.max(0, comment.likes + (comment.liked ? -1 : 1)),
            }
          : comment
      )
    );
  }, []);

  return (
    <div className="relative w-full overflow-visible" data-testid={`post-card-${post.id}`}>
      {post.isSponsored && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.18)" }}>
          <Sparkles size={11} style={{ color: "#FF2FA4" }} />
          <span className="text-[11px] font-semibold tracking-wide text-white/90">Sponsored</span>
        </div>
      )}

      <div className="flex items-center gap-2.5 px-0.5 pb-2.5">
        <button onClick={() => setLocation(`/user/${post.userId}`)} className="shrink-0" aria-label={author.displayName}>
          <img src={avatarSrc} alt={author.displayName} className="h-11 w-11 rounded-full object-cover" style={{ boxShadow: "0 0 0 2px #FF1493, 0 0 0 3px rgba(0,140,255,.65)" }} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setLocation(`/user/${post.userId}`)} className="truncate text-[16px] font-bold leading-tight text-white">{author.displayName}</button>
            {author.verified && <BadgeCheck size={14} className="shrink-0 text-blue-400" />}
            {author.userId && !isOwnPost && !post.isSponsored && (
              <motion.button whileTap={{ scale: 0.93 }} onClick={() => void handleFollow()} disabled={followLoading} className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold text-white disabled:opacity-60" style={{ background: following ? "rgba(255,255,255,.11)" : "linear-gradient(135deg,#FF1493,#008CFF)", border: following ? "1px solid rgba(255,255,255,.16)" : "none", boxShadow: following ? "none" : "0 3px 12px rgba(255,20,147,.24)" }}>
                {following ? t("following") : t("follow")}
              </motion.button>
            )}
            {post.isSponsored && post.sponsorCta && (
              <motion.button whileTap={{ scale: 0.93 }} className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold text-white" style={{ background: "linear-gradient(135deg,#FF1493,#008CFF)", boxShadow: "0 3px 12px rgba(255,20,147,.24)" }}>
                {post.sponsorCta}
              </motion.button>
            )}
          </div>
          {post.location && <div className="mt-1 truncate text-[12px] text-white/48">{post.location}</div>}
        </div>
        {onOptions && !post.isSponsored && (
          <motion.button whileTap={{ scale: 0.88 }} className="shrink-0 rounded-full p-1.5" onClick={onOptions} aria-label={t("moreOptions")} data-testid="post-options-btn">
            <MoreHorizontal size={23} className="text-white/60" strokeWidth={2.2} />
          </motion.button>
        )}
      </div>

      <div className="relative w-full overflow-hidden rounded-[20px] bg-black" style={{ aspectRatio: "1 / 1", boxShadow: post.isSponsored ? "0 8px 30px rgba(255,20,147,.15)" : "0 5px 24px rgba(0,0,0,.34)" }}>
        <img src={post.imageUrl} alt={post.caption} className="absolute inset-0 block h-full w-full object-cover" onClick={handleImageTap} loading="eager" decoding="auto" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: "linear-gradient(to top,rgba(0,0,0,.22),transparent)" }} />
        <AnimatePresence>
          {heartBurst && (
            <motion.div key="heart-burst" initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 1.6, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <Heart size={100} className="fill-red-500 text-red-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between px-0.5 pt-3 pb-2">
        <div className="flex items-center gap-6">
          <ActionBtn icon={<Heart size={25} className={liked ? "fill-[#FF2FA4] text-[#FF2FA4]" : "text-white/90"} strokeWidth={1.8} />} label={formatCount(likeCount)} onClick={handleLike} testId="btn-like" active={liked} />
          <ActionBtn icon={<MessageCircle size={25} className="text-white/90" strokeWidth={1.8} />} label={formatCount(post.comments)} onClick={() => void openComments(false)} testId="btn-comment" />
          <ActionBtn icon={<Share2 size={25} className="text-white/90" strokeWidth={1.8} />} label={formatCount(post.shares)} onClick={() => {}} testId="btn-share" />
        </div>
        <ActionBtn icon={<Bookmark size={25} className={saved ? "fill-[#FF2FA4] text-[#FF2FA4]" : "text-white/90"} strokeWidth={1.8} />} label={formatCount(post.saves)} onClick={handleSave} testId="btn-save" active={saved} />
      </div>

      <div className="px-0.5 pb-1">
        <p className="text-[14px] font-bold leading-tight text-white">{author.displayName}</p>
        {post.caption && <p className="mt-1 line-clamp-3 text-[13px] leading-[1.35] text-white/80">{post.caption}</p>}
        {post.hashtags.length > 0 && <p className="mt-1 text-[13px] font-medium" style={{ color: "#FF2FA4" }}>{post.hashtags.slice(0, 3).join(" ")}</p>}
        <button type="button" onClick={() => void openComments(false)} className="mt-2 block text-left text-[12px] text-white/42">
          View all {formatCount(post.comments)} comments · {post.timestamp}
        </button>
      </div>

      {(viewerOpen || commentsOpen) && (
        <PostViewer
          post={post}
          author={author}
          showViewer={viewerOpen}
          liked={liked}
          likeCount={likeCount}
          saved={saved}
          onClose={() => {
            setCommentsOpen(false);
            setViewerOpen(false);
            setViewerOptionsOpen(false);
            onViewerClose?.();
          }}
          onLike={handleLike}
          onComment={() => void openComments(true)}
          onShare={() => {}}
          onSave={handleSave}
          optionsOpen={viewerOptionsOpen}
          onToggleOptions={() => setViewerOptionsOpen((open) => !open)}
          onCloseOptions={() => setViewerOptionsOpen(false)}
          onDownload={downloadImage}
          commentsOpen={commentsOpen}
          comments={comments}
          commentsLoading={commentsLoading}
          commentText={commentText}
          setCommentText={setCommentText}
          onSubmitComment={submitComment}
          onLikeComment={toggleCommentLike}
          onCloseComments={() => setCommentsOpen(false)}
        />
      )}
    </div>
  );
}

function avatarSrcForViewer(author: LiveAuthor) {
  return (
    author.avatarUrl ??
    `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(author.displayName)}&backgroundColor=FF006E`
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
      className="flex items-center gap-2 text-left touch-manipulation"
      data-testid={testId}
      whileTap={{ scale: 0.9 }}
      animate={active ? { scale: [1, 1.03, 1] } : { scale: 1 }}
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span className="text-[13px] font-medium text-white/72">{label}</span>
    </motion.button>
  );
}


function PostViewer({
  post,
  author,
  showViewer,
  liked,
  likeCount,
  saved,
  onClose,
  onLike,
  onComment,
  onShare,
  onSave,
  optionsOpen,
  onToggleOptions,
  onCloseOptions,
  onDownload,
  commentsOpen,
  comments,
  commentsLoading,
  commentText,
  setCommentText,
  onSubmitComment,
  onLikeComment,
  onCloseComments,
}: {
  post: Post;
  author: LiveAuthor;
  showViewer: boolean;
  liked: boolean;
  likeCount: number;
  saved: boolean;
  onClose: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  optionsOpen: boolean;
  onToggleOptions: () => void;
  onCloseOptions: () => void;
  onDownload: () => void;
  commentsOpen: boolean;
  comments: Array<{
    id: string;
    userId: string;
    text: string;
    displayName: string;
    avatar: string;
    likes: number;
    liked: boolean;
    timestamp: string;
  }>;
  commentsLoading: boolean;
  commentText: string;
  setCommentText: (value: string) => void;
  onSubmitComment: () => void;
  onLikeComment: (id: string) => void;
  onCloseComments: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] pointer-events-none">
      {showViewer && (
        <>
          <div className="absolute inset-0 bg-black pointer-events-auto overflow-hidden">
            {/* The photo is sized by its real aspect ratio. Black space is only the natural
                remainder of the viewport, never a forced crop or a fixed image box. */}
            <div className="absolute inset-x-0 top-[64px] bottom-[94px] flex items-center justify-center overflow-hidden">
              <div className="relative inline-block max-w-full max-h-full">
                <img
                  src={post.imageUrl}
                  alt={post.caption}
                  className="block max-w-full max-h-[calc(100vh-158px)] w-auto h-auto object-contain"
                />
              </div>
            </div>

            {/* Only the two primary controls stay in the top bar. */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-2 left-3 z-[92] w-10 h-10 flex items-center justify-center pointer-events-auto touch-manipulation"
              aria-label="Close image"
            >
              <X size={29} strokeWidth={1.8} className="text-white drop-shadow-[0_2px_5px_rgba(0,0,0,.65)]" />
            </button>

            <button
              type="button"
              onClick={onToggleOptions}
              className="absolute top-2 right-3 z-[92] w-10 h-10 flex items-center justify-center pointer-events-auto touch-manipulation"
              aria-label={t("moreOptions")}
              aria-expanded={optionsOpen}
            >
              <MoreVertical size={27} strokeWidth={2} className="text-white drop-shadow-[0_2px_5px_rgba(0,0,0,.65)]" />
            </button>

            {optionsOpen && (
              <div
                className="absolute inset-0 z-[98] bg-black/35 pointer-events-auto"
                onClick={onCloseOptions}
                role="presentation"
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("moreOptions")}
                  className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[430px] rounded-t-[24px] overflow-hidden border border-white/10 bg-[#16131d]/[.98] shadow-[0_-18px_55px_rgba(0,0,0,.65)]"
                  style={{ paddingBottom: "env(safe-area-inset-bottom,0px)" }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="px-4 pt-3 pb-2">
                    <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
                    <h2 className="mt-3 text-center text-white text-base font-semibold">{t("moreOptions")}</h2>
                  </div>
                  <div className="px-3 pb-3">
                    <button
                      type="button"
                      onClick={onDownload}
                      className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-white transition-colors active:bg-white/10 touch-manipulation"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <Download size={23} strokeWidth={1.9} />
                      </span>
                      <span className="text-[15px] font-semibold">{t("downloadImage")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSave();
                        onCloseOptions();
                      }}
                      className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left text-white transition-colors active:bg-white/10 touch-manipulation"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <Bookmark size={23} strokeWidth={1.9} className={saved ? "fill-yellow-400 text-yellow-400" : "text-white"} />
                      </span>
                      <span className="text-[15px] font-semibold">{saved ? t("unsavePost") : t("savePost")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onCloseOptions}
                      className="mt-1 w-full rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white/55 touch-manipulation"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* Facebook-like proportions: shorter rounded pills, separated by real black space. */}
            <div
              className="absolute inset-x-0 bottom-0 z-[82] px-6 pt-1 pb-[calc(7px+env(safe-area-inset-bottom,0px))] pointer-events-auto"
              style={{
                background: "linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.92) 72%, rgba(0,0,0,0.72) 100%)",
              }}
            >
              <div className="mx-auto flex w-full max-w-[680px] items-center gap-4">
                <ViewerAction
                  icon={<Heart size={21} strokeWidth={1.9} className={liked ? "fill-blue-500 text-blue-500" : "text-white"} />}
                  label={formatCount(likeCount)}
                  onClick={onLike}
                  active={liked}
                />
                <ViewerAction
                  icon={<MessageCircle size={22} strokeWidth={1.9} className="text-white" />}
                  label={formatCount(post.comments + comments.length)}
                  onClick={onComment}
                />
                <ViewerAction
                  icon={<Share2 size={22} strokeWidth={1.9} className="text-white" />}
                  label={formatCount(post.shares)}
                  onClick={onShare}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {commentsOpen && (
        <div className="absolute inset-0 z-[90] bg-black/45 pointer-events-auto">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Comments"
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[430px] h-[78vh] rounded-t-[22px] overflow-hidden flex flex-col pointer-events-auto"
            style={{
              background: "rgba(18,15,30,0.99)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 -14px 45px rgba(0,0,0,0.55)",
              paddingBottom: "env(safe-area-inset-bottom,0px)",
            }}
          >
            <div className="shrink-0 px-4 pt-3 pb-2">
              <button
                type="button"
                onClick={onCloseComments}
                className="mx-auto mb-3 flex h-8 w-16 items-center justify-center rounded-full touch-manipulation"
                aria-label="Close comments"
                title="Close comments"
              >
                <span className="block w-10 h-1 rounded-full bg-white/25" />
              </button>
              <h2 className="text-center text-white font-semibold text-base">{t("comments")}</h2>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
              {commentsLoading ? (
                <div className="h-full flex items-center justify-center text-white/40 text-sm">Loading…</div>
              ) : comments.length === 0 ? (
                <div className="h-full min-h-[180px] flex items-center justify-center px-8 text-center text-white/40 text-sm">
                  {t("comments")}
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 px-3 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
                    <img src={comment.avatar} alt={comment.displayName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-white font-semibold text-sm">{comment.displayName}</span>
                        <span className="text-white/80 text-sm break-words">{comment.text}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-white/35 text-xs">{comment.timestamp}</span>
                        <button onClick={() => onLikeComment(comment.id)} className={comment.liked ? "text-pink-400 text-xs" : "text-white/40 text-xs"}>
                          {comment.likes} {t("like")}
                        </button>
                        <button className="text-white/40 text-xs">{t("replyTo")}</button>
                      </div>
                    </div>
                    <button onClick={() => onLikeComment(comment.id)} className="shrink-0 pt-1">
                      <Heart size={15} strokeWidth={1.8} className={comment.liked ? "fill-pink-500 text-pink-500" : "text-white/35"} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 px-3 py-3" style={{ background: "rgba(13,11,20,0.98)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-center px-3 py-2 rounded-full" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onSubmitComment(); }}
                    placeholder={t("writeComment")}
                    className="w-full bg-transparent text-white/85 text-sm outline-none placeholder:text-white/30"
                  />
                </div>
                <button
                  onClick={onSubmitComment}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: commentText.trim() ? "linear-gradient(135deg,#FF1493,#008CFF)" : "rgba(255,255,255,0.08)" }}
                >
                  <Send size={14} className={commentText.trim() ? "text-white" : "text-white/30"} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ViewerAction({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      className="min-w-0 flex-1 h-[52px] flex items-center justify-center gap-2 px-3 rounded-full bg-[#242424] border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,.3)] touch-manipulation"
    >
      <div className="shrink-0 flex items-center justify-center">{icon}</div>
      <span className={active ? "text-blue-400 text-xs font-semibold truncate" : "text-white text-xs font-medium truncate"}>{label}</span>
    </motion.button>
  );
}
