import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BookmarkIcon } from "lucide-react";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";
import { apiJson } from "@/lib/api";

interface SavedPost {
  id: number;
  caption: string;
  mediaUrl: string | null;
}

export default function Saved() {
  const [, setLocation] = useLocation();
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    apiJson<{ posts: SavedPost[] }>("/posts/saved")
      .then((result) => setSavedPosts(result.posts ?? []))
      .catch((requestError: unknown) => {
        setSavedPosts([]);
        setError(requestError instanceof Error ? requestError.message : "Unable to load saved posts");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="saved-header"
      >
        <button onClick={() => setLocation("/profile")} data-testid="btn-back-saved">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("saved")}</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 rounded-full border-2 border-white/20 border-t-pink-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <BookmarkIcon size={48} className="text-white/20" />
          <p className="text-white/60 text-sm">Unable to load saved posts</p>
          <p className="text-white/30 text-xs">{error}</p>
        </div>
      ) : savedPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <BookmarkIcon size={48} className="text-white/20" />
          <p className="text-white/40 text-sm">No saved posts yet</p>
          <p className="text-white/25 text-xs">Posts you save will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 px-0.5 pt-1">
          {savedPosts.map((post) => (
            <button
              key={post.id}
              onClick={() => setLocation(`/post/live_${post.id}`)}
              className="aspect-square overflow-hidden"
              data-testid={`saved-post-${post.id}`}
            >
              {post.mediaUrl ? (
                <img
                  src={post.mediaUrl}
                  alt={post.caption}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full p-3 flex items-center justify-center bg-black/20">
                  <p className="text-white/80 text-xs leading-snug line-clamp-6 text-left">
                    {post.caption || "Saved post"}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
