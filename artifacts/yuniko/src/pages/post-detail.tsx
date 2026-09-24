import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Send, BadgeCheck, MoreHorizontal, Trash2, Flag, Copy } from "lucide-react";
import { posts, getUserById, formatCount } from "@/data/mockData";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
import ScreenPortal from "@/components/ScreenPortal";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

interface DetailComment {
  id: string;
  userId: string;
  text: string;
  timestamp: string;
  likes: number;
  liked: boolean;
  author?: {
    id: string;
    displayName: string;
    avatar: string;
    verified: boolean;
  };
}

export default function PostDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ postId: string }>();
  const postId = params?.postId ?? "";
  const { user: authUser } = useAuth();
  const fallbackPost = posts.find((p) => p.id === postId) ?? null;
  const fallbackUser = fallbackPost ? getUserById(fallbackPost.userId) : null;
  const isLivePost = postId.startsWith("live_");
  const livePostId = isLivePost ? postId.slice("live_".length) : null;

  const [remotePost, setRemotePost] = useState<any>(null);
  const [remoteUser, setRemoteUser] = useState<any>(null);
  const [loadingRemotePost, setLoadingRemotePost] = useState(isLivePost);
  const [livePostError, setLivePostError] = useState(false);
  const [liked, setLiked] = useState(fallbackPost?.isLiked ?? false);
  const [saved, setSaved] = useState(fallbackPost?.isSaved ?? false);
  const [likeCount, setLikeCount] = useState(fallbackPost?.likes ?? 0);
  const [commentText, setCommentText] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [following, setFollowing] = useState(fallbackUser?.isFollowing ?? false);
  const [localComments, setLocalComments] = useState<DetailComment[]>([
    { id: "c1", userId: "u1", text: "Absolutely stunning! 😍", timestamp: "2h", likes: 45, liked: false },
    { id: "c2", userId: "u3", text: "Where is this place? I need to go!", timestamp: "3h", likes: 23, liked: false },
    { id: "c3", userId: "u2", text: "The lighting in this shot is incredible 🎨", timestamp: "5h", likes: 12, liked: false },
    { id: "c4", userId: "u5", text: "This made my day ❤️", timestamp: "6h", likes: 8, liked: false },
    { id: "c5", userId: "u4", text: "Goals 🌊✨", timestamp: "8h", likes: 34, liked: false },
  ]);

  useEffect(() => {
    if (!livePostId) return;
    Promise.all([
      apiJson<any>(`/posts/${livePostId}`),
      apiJson<{ comments?: Array<any> }>(`/posts/${livePostId}/comments`),
    ])
      .then(([postData, commentData]) => {
        const p = postData.post;
        setRemotePost({
          id: `live_${p.id}`,
          userId: `live_${p.userId}`,
          imageUrl: p.mediaUrl ?? "",
          caption: p.caption ?? "",
          hashtags: p.hashtags ? p.hashtags.split(/[\s,]+/).filter(Boolean) : [],
          likes: p.likes ?? 0,
          comments: p.comments ?? 0,
          shares: p.shares ?? 0,
          saves: p.saves ?? 0,
          timestamp: new Date(p.createdAt).toLocaleDateString(),
          location: p.location ?? undefined,
        });
        setRemoteUser({
          id: String(p.userId),
          displayName: p.authorDisplayName,
          username: p.authorUsername,
          avatar: p.authorAvatarUrl ??
            `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(p.authorDisplayName)}&backgroundColor=FF006E`,
          verified: false,
        });
        setLiked(Boolean(postData.liked));
        setSaved(Boolean(postData.saved));
        setLikeCount(p.likes ?? 0);
        setLocalComments((commentData.comments ?? []).map((comment) => ({
          id: String(comment.id),
          userId: String(comment.userId),
          text: comment.text,
          timestamp: new Date(comment.createdAt).toLocaleDateString(),
          likes: 0,
          liked: false,
          author: {
            id: String(comment.userId),
            displayName: comment.displayName,
            avatar: comment.avatarUrl ??
              `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(comment.displayName)}&backgroundColor=FF006E`,
            verified: false,
          },
        })));
      })
      .catch(() => {
        setRemotePost(null);
        setRemoteUser(null);
        setLivePostError(true);
      })
      .finally(() => setLoadingRemotePost(false));
  }, [fallbackPost, livePostId]);

  const post = remotePost ?? fallbackPost;
  const user = remoteUser ?? fallbackUser;

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation("/");
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    if (livePostId) {
      try {
        await apiJson(`/posts/${livePostId}/comments`, {
          method: "POST",
          body: JSON.stringify({ text: commentText.trim() }),
        });
      } catch {
        return;
      }
    }
    setLocalComments((prev) => [
      ...prev,
      {
        id: `c${Date.now()}`,
        userId: "me",
        text: commentText.trim(),
        timestamp: "just now",
        likes: 0,
        liked: false,
        author: authUser ? {
          id: String(authUser.id),
          displayName: authUser.displayName,
          avatar: authUser.avatarUrl ?? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(authUser.displayName)}&backgroundColor=FF006E`,
          verified: false,
        } : undefined,
      },
    ]);
    setCommentText("");
  };

  const toggleCommentLike = (id: string) => {
    setLocalComments((prev) =>
      prev.map((c) => c.id === id ? { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 } : c)
    );
  };

  const toggleLike = async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
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
      setLikeCount((count) => Math.max(0, count + (nextLiked ? -1 : 1)));
    }
  };

  const toggleSave = async () => {
    const nextSaved = !saved;
    setSaved(nextSaved);
    if (!livePostId) return;
    try {
      const result = await apiJson<{ saved: boolean }>(
        `/posts/${livePostId}/save`,
        { method: "POST" },
      );
      setSaved(result.saved);
    } catch {
      setSaved(saved);
    }
  };

  const toggleFollow = async () => {
    if (!user) return;
    const numericId = Number(user.id);
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    if (!Number.isInteger(numericId) || numericId <= 0) return;
    try {
      const result = await apiJson<{ following: boolean }>(
        `/users/${numericId}/follow`,
        { method: "POST" },
      );
      setFollowing(result.following);
    } catch {
      setFollowing(following);
    }
  };

  if (loadingRemotePost) {
    return (
      <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-white/20 border-t-pink-400 animate-spin" />
      </div>
    );
  }

  if (isLivePost && livePostError) {
    return (
      <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-white/70">Post not found or already deleted.</p>
        <button onClick={goBack} className="px-5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: GRADIENT }}>
          Back
        </button>
      </div>
    );
  }

  if (!post || !user) return null;

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background" style={{ paddingBottom: 160 }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{
          background: "rgba(13,11,20,0.96)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="post-detail-header"
      >
        <button onClick={goBack} data-testid="btn-back-post">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white flex-1">Post</h1>
        <button onClick={() => setShowOptions(true)} data-testid="btn-post-detail-options">
          <MoreHorizontal size={22} className="text-white/80" />
        </button>
      </header>

      {/* User row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setLocation(`/user/${user.id}`)}>
          <img src={user.avatar} alt={user.displayName} className="w-10 h-10 rounded-full object-cover" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <button onClick={() => setLocation(`/user/${user.id}`)}>
              <span className="text-white font-semibold text-sm">{user.displayName}</span>
            </button>
            {user.verified && <BadgeCheck size={14} className="text-blue-400 fill-blue-400" />}
          </div>
          <p className="text-white/50 text-xs">@{user.username} · {post.timestamp} {t("ago")}</p>
        </div>
        <button
          onClick={toggleFollow}
          className="px-4 py-1.5 rounded-full text-sm font-semibold text-white"
          style={{
            background: following ? "rgba(255,255,255,0.1)" : GRADIENT,
            border: following ? "1px solid rgba(255,255,255,0.15)" : "none",
            boxShadow: following ? "none" : "0 2px 8px rgba(255,0,110,0.3)",
          }}
          data-testid="btn-follow-post-detail"
        >
          {following ? t("following") : t("follow")}
        </button>
      </div>

      {/* Post image */}
      <div className="w-full">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={post.caption} className="w-full object-cover" style={{ maxHeight: 520 }} />
        ) : (
          <div className="w-full min-h-[180px] flex items-center justify-center px-6 text-center text-white/40 text-sm">
            No media attached to this post.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3">
        <button
          onClick={toggleLike}
          className="flex items-center gap-1.5"
          data-testid="btn-like-detail"
        >
          <Heart
            size={24}
            strokeWidth={1.8}
            style={{ color: liked ? "#FF006E" : undefined, fill: liked ? "#FF006E" : undefined }}
            className={liked ? "" : "text-white/80"}
          />
          <span className="text-white/80 text-sm font-medium">{formatCount(likeCount)}</span>
        </button>
        <button className="flex items-center gap-1.5" data-testid="btn-comment-detail">
          <MessageCircle size={24} className="text-white/80" strokeWidth={1.8} />
          <span className="text-white/80 text-sm font-medium">{formatCount(post.comments + localComments.filter(c => c.id.startsWith("c") && !["c1","c2","c3","c4","c5"].includes(c.id)).length)}</span>
        </button>
        <button className="flex items-center gap-1.5" data-testid="btn-share-detail">
          <Share2 size={24} className="text-white/80" strokeWidth={1.8} />
          <span className="text-white/80 text-sm font-medium">{formatCount(post.shares)}</span>
        </button>
        <div className="flex-1" />
        <button onClick={toggleSave} data-testid="btn-save-detail">
          <Bookmark
            size={24}
            strokeWidth={1.8}
            className={saved ? "" : "text-white/80"}
            style={{ color: saved ? "#FFD700" : undefined, fill: saved ? "#FFD700" : undefined }}
          />
        </button>
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        <p className="text-white text-sm leading-snug">
          <button onClick={() => setLocation(`/user/${user.id}`)} className="font-bold mr-1">{user.displayName}</button>
          {post.caption}
        </p>
        <p className="text-sm mt-1.5 flex flex-wrap gap-1">
          {post.hashtags.map((tag: string) => (
            <button
              key={tag}
              onClick={() => setLocation(`/hashtag/${tag.replace("#", "")}`)}
              style={{ color: "#FF3D9A" }}
              className="font-medium"
            >
              {tag}
            </button>
          ))}
        </p>
      </div>

      {/* Comments */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="px-4 py-3 text-white/50 text-xs font-semibold uppercase tracking-wider">
          {localComments.length} {t("comments")}
        </p>
        {localComments.map((comment) => {
          const cUser = comment.author ?? (comment.userId === "me"
            ? { id: "me", displayName: "You", avatar: "https://picsum.photos/seed/me/200/200", verified: false }
            : getUserById(comment.userId));
          if (!cUser) return null;
          return (
            <div
              key={comment.id}
              className="flex gap-3 px-4 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <button onClick={() => comment.userId !== "me" && setLocation(`/user/${cUser.id}`)}>
                <img src={cUser.avatar} alt={cUser.displayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              </button>
              <div className="flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <button onClick={() => comment.userId !== "me" && setLocation(`/user/${cUser.id}`)}>
                    <span className="text-white font-semibold text-sm">{cUser.displayName}</span>
                  </button>
                  <span className="text-white/75 text-sm">{comment.text}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-white/35 text-xs">{comment.timestamp} {comment.timestamp !== "just now" ? t("ago") : ""}</span>
                  <button className="text-white/35 text-xs">{comment.likes} {t("like")}</button>
                  <button className="text-white/35 text-xs">{t("replyTo")}</button>
                </div>
              </div>
              <button onClick={() => toggleCommentLike(comment.id)} data-testid={`comment-like-${comment.id}`}>
                <Heart
                  size={14}
                  strokeWidth={1.8}
                  style={{ color: comment.liked ? "#FF006E" : undefined, fill: comment.liked ? "#FF006E" : undefined }}
                  className={comment.liked ? "" : "text-white/40"}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Comment input */}
      <div
        className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-3"
        style={{
          background: "rgba(13,11,20,0.96)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="comment-input-bar"
      >
        <div className="flex items-center gap-2.5">
          <img src="https://picsum.photos/seed/me/200/200" alt="me" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }}
              placeholder={t("writeComment")}
              className="flex-1 bg-transparent text-white/80 text-sm outline-none placeholder:text-white/30"
              data-testid="input-comment"
            />
          </div>
          <button
            onClick={submitComment}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: commentText.trim() ? GRADIENT : "rgba(255,255,255,0.08)",
              boxShadow: commentText.trim() ? "0 2px 8px rgba(255,0,110,0.3)" : "none",
            }}
            data-testid="btn-send-comment"
          >
            <Send size={14} className={commentText.trim() ? "text-white" : "text-white/30"} />
          </button>
        </div>
      </div>

      <BottomNav />

      {/* Post options */}
      {showOptions && (
        <ScreenPortal>
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowOptions(false)} />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-[430px] max-h-[80vh] z-50 rounded-2xl overflow-y-auto"
            style={{ background: "rgba(18,15,30,0.98)", border: "1px solid rgba(255,0,110,0.15)" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-2" />
            {[
              { icon: <Bookmark size={18} className="text-white/70" />, label: saved ? t("unsavePost") : t("savePost"), action: () => { void toggleSave(); setShowOptions(false); } },
              { icon: <Share2 size={18} className="text-white/70" />, label: t("sharePost"), action: () => setShowOptions(false) },
              { icon: <Copy size={18} className="text-white/70" />, label: t("copyLink"), action: () => setShowOptions(false) },
              { icon: <Flag size={18} className="text-red-400" />, label: <span className="text-red-400">{t("report")}</span>, action: () => setShowOptions(false) },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                className="w-full flex items-center gap-3 px-5 py-4 text-white/85 text-sm font-medium active:bg-white/5"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
              >
                {item.icon} {item.label}
              </button>
            ))}
            <button
              onClick={() => setShowOptions(false)}
              className="w-full py-4 text-white/50 text-sm font-medium border-t border-white/10"
            >
              {t("cancel")}
            </button>
          </div>
        </>
        </ScreenPortal>
      )}
    </div>
  );
}
