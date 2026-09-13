import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Send, MoreHorizontal, Flag, Trash2 } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";

type Post = {
  id: number; userId: number; caption: string; mediaUrl: string | null; mediaType: string;
  mediaItems?: string | null; likes: number; comments: number; shares: number; saves: number; views?: number;
  liked: boolean; saved: boolean; authorDisplayName: string; authorUsername: string;
  authorAvatarUrl: string | null; createdAt: string; hashtags: string | null;
};
type Comment = { id: number; text: string; createdAt: string; authorDisplayName: string; authorUsername: string; authorAvatarUrl: string | null };

function safePostId(value: string | undefined): number | null {
  const normalized = (value ?? "").replace(/^live_/, "");
  const id = Number(normalized);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export default function PostDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ postId: string }>();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const id = safePostId(params?.postId);
  const [text, setText] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const postQuery = useQuery({
    queryKey: ["post", id],
    enabled: id !== null,
    queryFn: () => apiJson<{ post: Post }>(`/posts/${id}`),
    staleTime: 15_000,
    retry: 1,
  });

  const commentsQuery = useQuery({
    queryKey: ["post-comments", id],
    enabled: id !== null,
    queryFn: () => apiJson<{ comments: Comment[]; nextCursor?: number | null; hasMore?: boolean }>(`/posts/${id}/comments?limit=50`),
    staleTime: 15_000,
    retry: 1,
  });

  const post = postQuery.data?.post ?? null;
  const comments = commentsQuery.data?.comments ?? [];

  const actionMutation = useMutation({
    mutationFn: async (type: "like" | "save" | "report") =>
      apiJson<{ active: boolean; post: Post }>(`/posts/${id}/${type}`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.setQueryData(["post", id], { post: data.post });
      queryClient.invalidateQueries({ queryKey: ["world-feed"] });
    },
  });

  const submitCommentMutation = useMutation({
    mutationFn: async (body: string) => apiJson<{ comment: Comment }>(`/posts/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ text: body }),
    }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["post-comments", id] });
      queryClient.invalidateQueries({ queryKey: ["post", id] });
      queryClient.invalidateQueries({ queryKey: ["world-feed"] });
    },
  });

  useEffect(() => {
    if (!post || id === null) return;
    const timer = window.setTimeout(() => {
      void apiJson<{ viewed: boolean; post?: { views: number } }>(`/posts/${id}/view`, {
        method: "POST",
        body: JSON.stringify({ watchMs: 1200, completionRate: 75 }),
      }).then((data) => {
        if (data.post?.views !== undefined) {
          queryClient.setQueryData<{ post: Post }>(["post", id], (current) =>
            current ? { post: { ...current.post, views: data.post!.views } } : current,
          );
        }
      }).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [post?.id, id, queryClient]);

  const share = async () => {
    if (!post || actionMutation.isPending) return;
    const url = `${window.location.origin}/post/${post.id}`;
    let shared = false;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${post.authorDisplayName} on Yuniko`, text: post.caption || "Check out this post on Yuniko", url });
        shared = true;
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        shared = true;
      }
    } catch {
      shared = false;
    }
    if (!shared) return;
    const data = await apiJson<{ shared: boolean; post: Post }>(`/posts/${post.id}/share`, { method: "POST" }).catch(() => null);
    if (data?.post) queryClient.setQueryData(["post", id], { post: data.post });
    queryClient.invalidateQueries({ queryKey: ["world-feed"] });
  };

  const deletePost = async () => {
    if (!post || post.userId !== me?.id || deleting) return;
    if (!window.confirm("Delete this post permanently?")) return;
    setDeleting(true);
    const ok = await apiJson<{ success: boolean }>(`/posts/${post.id}`, { method: "DELETE" }).then((d) => d.success).catch(() => false);
    setDeleting(false);
    if (ok) {
      queryClient.removeQueries({ queryKey: ["post", id] });
      queryClient.removeQueries({ queryKey: ["post-comments", id] });
      queryClient.invalidateQueries({ queryKey: ["world-feed"] });
      setLocation("/profile");
    }
  };

  const submitComment = () => {
    const body = text.trim();
    if (!body || !post || submitCommentMutation.isPending) return;
    submitCommentMutation.mutate(body);
  };

  if (id === null) return <div className="min-h-screen bg-background flex items-center justify-center text-white/40">Post not found</div>;
  if (postQuery.isLoading) return <div className="min-h-screen bg-background flex items-center justify-center text-white/40">Loading...</div>;
  if (postQuery.isError || !post) return <div className="min-h-screen bg-background flex items-center justify-center text-white/40">Post not found</div>;

  const av = post.authorAvatarUrl ?? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(post.authorDisplayName)}&backgroundColor=FF006E`;
  const own = post.userId === me?.id;

  return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-28">
    <header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3 bg-black/95 border-b border-white/5">
      <button onClick={() => window.history.back()} aria-label="Back"><ArrowLeft size={22} className="text-white/80" /></button>
      <h1 className="text-base font-semibold text-white flex-1">Post</h1>
      <div className="relative">
        <button aria-label="More" onClick={() => setShowMenu((v) => !v)}><MoreHorizontal size={22} className="text-white/70" /></button>
        {showMenu && own && <div className="absolute right-0 top-9 w-48 rounded-xl bg-[#181326] border border-white/10 shadow-2xl overflow-hidden">
          <button onClick={deletePost} disabled={deleting} className="w-full px-4 py-3 flex items-center gap-2 text-left text-red-400 text-sm"><Trash2 size={16} />{deleting ? "Deleting…" : "Delete post"}</button>
        </div>}
      </div>
    </header>

    <div className="flex items-center gap-3 px-4 py-3">
      <button onClick={() => setLocation(`/user/${post.userId}`)}><img src={av} className="w-10 h-10 rounded-full object-cover" /></button>
      <button onClick={() => setLocation(`/user/${post.userId}`)} className="flex-1 text-left"><p className="text-white font-semibold text-sm">{post.authorDisplayName}</p><p className="text-white/45 text-xs">@{post.authorUsername}</p></button>
    </div>

    {post.mediaUrl && <div className="w-full bg-black">{post.mediaType === "video" ? <video src={post.mediaUrl} controls playsInline className="w-full max-h-[560px] object-contain" /> : <img src={post.mediaUrl} alt={post.caption || "Post"} className="w-full max-h-[560px] object-contain" />}</div>}

    <div className="flex items-center gap-5 px-4 py-3">
      <button onClick={() => actionMutation.mutate("like")} disabled={actionMutation.isPending} className="flex items-center gap-1.5"><Heart size={24} className={post.liked ? "text-pink-500 fill-pink-500" : "text-white/80"} /><span className="text-white/70 text-sm">{post.likes}</span></button>
      <button onClick={() => document.getElementById("comment-input")?.focus()} className="flex items-center gap-1.5"><MessageCircle size={24} className="text-white/80" /><span className="text-white/70 text-sm">{post.comments}</span></button>
      <button onClick={share} className="flex items-center gap-1.5"><Share2 size={24} className="text-white/80" /><span className="text-white/70 text-sm">{post.shares}</span></button>
      <div className="flex-1" />
      <button onClick={() => actionMutation.mutate("save")} disabled={actionMutation.isPending}><Bookmark size={24} className={post.saved ? "text-yellow-400 fill-yellow-400" : "text-white/80"} /></button>
      <button onClick={() => actionMutation.mutate("report")} disabled={actionMutation.isPending}><Flag size={18} className="text-white/40" /></button>
    </div>

    <div className="px-4 pb-4"><p className="text-white text-sm"><b>{post.authorDisplayName}</b>{post.caption ? ` ${post.caption}` : ""}</p></div>

    <div className="border-t border-white/5">
      <p className="px-4 py-3 text-white/45 text-xs">{commentsQuery.isLoading ? "Loading comments…" : `${comments.length}${commentsQuery.data?.hasMore ? "+" : ""} comments`}</p>
      {comments.map((c) => <div key={c.id} className="flex gap-3 px-4 py-2.5"><img src={c.authorAvatarUrl ?? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(c.authorDisplayName)}`} className="w-8 h-8 rounded-full object-cover" /><div><p className="text-white text-sm"><b>{c.authorDisplayName}</b> {c.text}</p><span className="text-white/30 text-xs">{new Date(c.createdAt).toLocaleString()}</span></div></div>)}
    </div>

    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-3 py-3 bg-black/95 border-t border-white/5">
      <div className="flex gap-2"><input id="comment-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitComment()} placeholder="Write a comment..." className="flex-1 rounded-full bg-white/[.07] px-4 py-3 text-white outline-none" /><button onClick={submitComment} disabled={submitCommentMutation.isPending} className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-600"><Send size={16} className="text-white" /></button></div>
    </div>
    <BottomNav />
  </div>;
}
