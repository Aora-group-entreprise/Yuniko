import { useLocation, useParams } from "wouter";
import { ArrowLeft, Hash } from "lucide-react";
import { posts } from "@/data/mockData";
import { formatCount } from "@/data/mockData";
import BottomNav from "@/components/BottomNav";

export default function Hashtag() {
  const [, setLocation] = useLocation();
  const params = useParams<{ tag: string }>();
  const tag = params?.tag ?? "trending";

  const tagPosts = posts.slice(0, 6);
  const totalPosts = Math.floor(Math.random() * 9000000) + 500000;

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="hashtag-header"
      >
        <button onClick={() => setLocation(-1 as any)} data-testid="btn-back-hashtag">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">#{tag}</h1>
      </header>

      {/* Hashtag banner */}
      <div className="px-4 py-6 flex flex-col items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,0,110,0.12)", border: "2px solid rgba(255,0,110,0.3)" }}
        >
          <Hash size={36} style={{ color: "#FF3D9A" }} />
        </div>
        <h2
          className="text-2xl font-bold"
          style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          #{tag}
        </h2>
        <p className="text-white/50 text-sm">{formatCount(totalPosts)} posts</p>
        <button
          className="px-6 py-2 rounded-full text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 2px 12px rgba(255,0,110,0.4)" }}
        >
          Follow
        </button>
      </div>

      {/* Posts grid */}
      <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-1">
        {tagPosts.map((post) => (
          <button
            key={post.id}
            onClick={() => setLocation(`/post/${post.id}`)}
            className="aspect-square overflow-hidden"
            data-testid={`hashtag-post-${post.id}`}
          >
            <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
          </button>
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <button
            key={`extra-${i}`}
            className="aspect-square overflow-hidden"
          >
            <img src={`https://picsum.photos/seed/tag_${tag}_${i}/200/200`} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
