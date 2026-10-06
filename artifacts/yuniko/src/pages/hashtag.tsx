import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Hash } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { apiJson } from "@/lib/api";

interface HashtagPost {
  id: number;
  mediaUrl?: string | null;
  caption?: string | null;
  hashtags?: string | null;
  author?: { displayName?: string | null; username?: string | null; avatarUrl?: string | null };
}

interface SearchResponse {
  posts?: HashtagPost[];
  hashtags?: Array<{ tag: string; posts: number }>;
}

export default function Hashtag() {
  const [, setLocation] = useLocation();
  const params = useParams<{ tag: string }>();
  const tag = decodeURIComponent(params?.tag ?? "trending").replace(/^#/, "").trim().toLowerCase();
  const [posts, setPosts] = useState<HashtagPost[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiJson<SearchResponse>(`/users/search?q=${encodeURIComponent(tag)}`)
      .then((data) => {
        if (cancelled) return;
        const exactPosts = (data.posts ?? []).filter((post) =>
          String(post.hashtags ?? "").toLowerCase().split(/[,\s#]+/).filter(Boolean).includes(tag),
        );
        const exactCount = data.hashtags?.find((item) => item.tag.toLowerCase() === tag)?.posts ?? exactPosts.length;
        setPosts(exactPosts);
        setCount(Number(exactCount));
      })
      .catch(() => {
        if (!cancelled) { setPosts([]); setCount(0); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tag]);

  const title = useMemo(() => `#${tag}`, [tag]);

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => setLocation(-1 as any)} data-testid="btn-back-hashtag"><ArrowLeft size={22} className="text-white/80" /></button>
        <h1 className="text-base font-semibold text-white">{title}</h1>
      </header>

      <div className="px-4 py-6 flex flex-col items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(255,0,110,0.12)", border: "2px solid rgba(255,0,110,0.3)" }}>
          <Hash size={36} style={{ color: "#FF3D9A" }} />
        </div>
        <h2 className="text-2xl font-bold" style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{title}</h2>
        <p className="text-white/50 text-sm">{count.toLocaleString()} posts</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-white/45 text-sm">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="py-16 px-6 text-center text-white/45 text-sm">No posts found for this hashtag.</div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-1">
          {posts.map((post) => (
            <button key={post.id} onClick={() => setLocation(`/post/${post.id}`)} className="aspect-square overflow-hidden bg-black" data-testid={`hashtag-post-${post.id}`}>
              {post.mediaUrl ? <img src={post.mediaUrl} alt={post.caption ?? title} className="w-full h-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-white/35 text-xs px-2 text-center">{post.caption}</div>}
            </button>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
