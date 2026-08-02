import { useLocation } from "wouter";
import { ArrowLeft, BookmarkIcon } from "lucide-react";
import { posts } from "@/data/mockData";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

export default function Saved() {
  const [, setLocation] = useLocation();
  const savedPosts = posts.filter((p) => p.isSaved);

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

      {savedPosts.length === 0 ? (
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
              onClick={() => setLocation(`/post/${post.id}`)}
              className="aspect-square overflow-hidden"
              data-testid={`saved-post-${post.id}`}
            >
              <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
