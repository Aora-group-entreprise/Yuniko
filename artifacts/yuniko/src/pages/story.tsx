import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { X, Send, Heart, Share2, MoreVertical, MapPin, BadgeCheck, Eye } from "lucide-react";
import { t } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { getSessionCache } from "@/lib/session-cache";

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface LiveStory {
  id: number;
  userId: number;
  mediaUrl: string;
  caption: string;
  createdAt: string;
  authorDisplayName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  location?: string | null;
}

interface ViewerStory {
  id: string;
  userId: string;
  imageUrl: string;
  timestamp: string;
  location?: string | null;
}

export default function StoryViewer() {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "";
  const { user: authUser } = useAuth();
  const isLiveStory = userId.startsWith("live_");
  const requestedUserId = isLiveStory ? null : Number(userId);
  const cachedStories = getSessionCache<{ stories?: LiveStory[] }>("/stories");
  const cachedLiveStory = isLiveStory
    ? cachedStories?.stories?.find((story) => story.id === Number(userId.slice("live_".length))) ?? null
    : null;
  const [liveStory, setLiveStory] = useState<LiveStory | null>(cachedLiveStory);
  const [liveStoryLoading, setLiveStoryLoading] = useState(true);

  useEffect(() => {
    if (!authUser) {
      setLiveStoryLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const cached = getSessionCache<{ stories?: LiveStory[] }>("/stories");
        let selected: LiveStory | null = null;
        if (isLiveStory) {
          const storyId = Number(userId.slice("live_".length));
          selected = cached?.stories?.find((story) => story.id === storyId) ?? null;
          const response = await apiFetch(`/stories/${storyId}`);
          if (!response.ok) throw new Error("Story unavailable");
          const data = await response.json() as { story?: LiveStory };
          selected = data.story ?? selected;
          if (selected) void apiFetch(`/stories/${selected.id}/view`, { method: "POST" }).catch(() => {});
        } else if (requestedUserId !== null && Number.isInteger(requestedUserId) && requestedUserId > 0) {
          const response = await apiFetch("/stories");
          if (!response.ok) throw new Error("Stories unavailable");
          const data = await response.json() as { stories?: LiveStory[] };
          selected = (data.stories ?? []).find((story) => Number(story.userId) === Number(requestedUserId)) ?? null;
          if (selected) void apiFetch(`/stories/${selected.id}/view`, { method: "POST" }).catch(() => {});
        }
        if (!cancelled) setLiveStory(selected);
      } catch {
        if (!cancelled) setLiveStory(null);
      } finally {
        if (!cancelled) setLiveStoryLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [authUser, isLiveStory, requestedUserId, userId]);

  const storyUser = liveStory
    ? {
        id: String(liveStory.userId),
        displayName: liveStory.authorDisplayName,
        username: liveStory.authorUsername,
        avatar: liveStory.authorAvatarUrl ??
          `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(liveStory.authorDisplayName)}&backgroundColor=FF006E`,
        verified: false,
      }
    : null;

  const userStories: ViewerStory[] = liveStory
    ? [{
        id: String(liveStory.id),
        userId: String(liveStory.userId),
        imageUrl: liveStory.mediaUrl,
        timestamp: relativeTime(liveStory.createdAt),
        location: liveStory.location ?? null,
      }]
    : [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [liked, setLiked] = useState(false);
  const [reactionShown, setReactionShown] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [viewers, setViewers] = useState<Array<{ userId:number; displayName:string; username:string; avatarUrl:string|null; reaction:string|null }>>([]);
  const [viewCount, setViewCount] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const STORY_DURATION = 5000;
  const segmentCount = Math.max(5, userStories.length);
  const isOwnStory = Boolean(authUser && liveStory && Number(liveStory.userId) === Number(authUser.id));
  const reactionOptions = ["❤️","👍","😂","😢","😮"];

  useEffect(() => {
    if (!isOwnStory || !liveStory) return;
    void apiFetch(`/stories/${liveStory.id}/views`).then(r=>r.json()).then((data:{viewCount?:number})=>setViewCount(Number(data.viewCount??0))).catch(()=>{});
  }, [isOwnStory, liveStory?.id]);

  useEffect(() => {
    if (!isOwnStory || !liveStory) return;
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (detail?.type !== "story:view" || Number(detail.storyId) !== Number(liveStory.id)) return;
      void apiFetch(`/stories/${liveStory.id}/views`).then(r=>r.json()).then((data:{viewCount?:number;viewers?:Array<{userId:number;displayName:string;username:string;avatarUrl:string|null;reaction:string|null}>})=>{
        setViewCount(Number(data.viewCount??0));
        if (Array.isArray(data.viewers)) setViewers(data.viewers);
      }).catch(()=>setViewCount(count=>count+1));
    };
    window.addEventListener("yuniko:realtime", onRealtime);
    return () => window.removeEventListener("yuniko:realtime", onRealtime);
  }, [isOwnStory, liveStory?.id]);

  useEffect(() => {
    const imageUrl=userStories[currentIndex]?.imageUrl;
    if(imageUrl){const image=new Image(); image.decoding="async"; image.src=imageUrl;}
  }, [currentIndex, userStories]);

  useEffect(() => {
    if (userStories.length === 0) return;

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < userStories.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          }
          setLocation("/");
          return 100;
        }
        return prev + 100 / (STORY_DURATION / 100);
      });
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentIndex, userStories.length, setLocation]);

  const goNext = () => {
    if (currentIndex < userStories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      setLocation("/");
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  };

  const chooseReaction = (reaction:string) => {
    setSelectedReaction(reaction); setLiked(true); setShowReactions(false); setReactionShown(true);
    window.setTimeout(() => setReactionShown(false), 700);
    if (isLiveStory && liveStory) void apiFetch(`/stories/${liveStory.id}/reaction`, { method:"POST", body:JSON.stringify({reaction}) }).catch(()=>{});
  };
  const openViewers = async () => {
    if (!isOwnStory || !liveStory) return;
    try { const response=await apiFetch(`/stories/${liveStory.id}/views`); const data=await response.json() as {viewCount?:number;viewers?:typeof viewers}; setViewCount(Number(data.viewCount??0)); setViewers(data.viewers??[]); } catch {}
    setShowViewers(true);
  };
  const sendStoryReply = async () => {
    const text=replyText.trim();
    if(!text||!isLiveStory||!liveStory||isOwnStory||replySending)return;
    setReplySending(true);
    try { const response=await apiFetch(`/stories/${liveStory.id}/reply`,{method:"POST",body:JSON.stringify({text})}); if(response.ok)setReplyText(""); } finally { setReplySending(false); }
  };

  if (liveStoryLoading) return <LoadingSkeleton variant="story" />;

  if (!storyUser || userStories.length === 0) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50">{t("noStories")}</p>
          <button onClick={() => setLocation("/")} className="mt-4" style={{ color: "#FF3D9A" }}>{t("back")}</button>
        </div>
      </div>
    );
  }

  const currentStory = userStories[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[100] h-[var(--yuniko-vh)] w-full overflow-hidden bg-black"
      style={{
        backgroundImage: "radial-gradient(ellipse 42% 75% at 0% 50%, rgba(255,20,147,.20), transparent 72%), radial-gradient(ellipse 42% 75% at 100% 50%, rgba(0,140,255,.20), transparent 72%)",
      }}
      data-testid="story-viewer"
    >
      <div className="relative mx-auto flex h-full w-full max-w-[430px] flex-col overflow-hidden bg-black md:max-w-[520px] md:shadow-[0_0_70px_rgba(0,0,0,.7)]">
        <div className="absolute inset-0 z-0 bg-black" data-testid="story-media">
          <img src={currentStory.imageUrl} alt="Story" className="h-full w-full object-cover" />
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[42%]"
          style={{ background: "linear-gradient(to bottom, rgba(5,4,10,.99) 0%, rgba(5,4,10,.96) 28%, rgba(5,4,10,.72) 58%, rgba(5,4,10,.08) 100%)" }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[30%]"
          style={{ background: "linear-gradient(to top, rgba(5,4,10,.99) 0%, rgba(5,4,10,.94) 38%, rgba(5,4,10,.48) 72%, transparent 100%)" }}
        />

        <div className="relative z-30 shrink-0 px-[clamp(1rem,4vw,2rem)] pt-[clamp(1rem,3vw,1.5rem)]">
          <div className="flex gap-[clamp(.45rem,1.5vw,.9rem)]" data-testid="story-progress">
            {Array.from({ length: segmentCount }).map((_, i) => {
              const isRealSegment = i < userStories.length;
              const width = !isRealSegment ? "0%" : i < currentIndex ? "100%" : i === currentIndex ? `${progress}%` : "0%";
              return (
                <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/[.07] ring-1 ring-white/20">
                  <div className="h-full rounded-full" style={{ width, background: "rgba(255,255,255,.98)", boxShadow: "0 0 8px rgba(255,255,255,.25)", transition: "width .1s linear" }} />
                </div>
              );
            })}
          </div>

          <div className="mt-[clamp(1rem,3vw,1.5rem)] flex items-center gap-3">
            <button onClick={() => setLocation(`/user/${storyUser.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left" data-testid="btn-story-user">
              <div className="size-[clamp(3.4rem,8vw,4.5rem)] shrink-0 rounded-full p-[3px]" style={{ background: "linear-gradient(135deg,#FF1493 0%,#8B5CF6 52%,#008CFF 100%)", boxShadow: "0 0 18px rgba(255,20,147,.3)" }}>
                <img src={storyUser.avatar} alt={storyUser.displayName} className="h-full w-full rounded-full border-[3px] border-[#090810] object-cover" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[clamp(1.05rem,3.5vw,1.55rem)] font-bold tracking-[-.025em] text-white">{storyUser.displayName}</span>
                  {storyUser.verified && <BadgeCheck size={15} className="fill-blue-300 text-blue-300" />}
                </div>
                <span className="text-[clamp(.85rem,2.5vw,1.05rem)] font-medium text-white/70">{currentStory.timestamp} {t("ago")}</span>
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-1">
              <span className="flex size-10 items-center justify-center rounded-full text-white/95" aria-hidden="true">
                <MoreVertical size={25} strokeWidth={2.4} />
              </span>
              <button onClick={() => setLocation("/")} className="flex size-10 items-center justify-center rounded-full text-white/95" aria-label="Close story" data-testid="btn-close-story">
                <X size={30} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-20 min-h-0 flex-1">
          <div className="absolute inset-0 flex">
            <button aria-label="Previous story" className="h-full w-1/2 cursor-default" onClick={goPrev} />
            <button aria-label="Next story" className="h-full w-1/2 cursor-default" onClick={goNext} />
          </div>
        </div>

        {reactionShown && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
            <Heart size={118} strokeWidth={1.4} className="animate-pulse" style={{ color: "#FF7BC5", fill: "rgba(255,20,147,.20)", filter: "drop-shadow(0 0 28px rgba(255,20,147,.8))" }} />
          </div>
        )}

        {!isOwnStory && <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-3">
          <div className="mx-auto flex w-full items-center gap-2">
            <button onClick={async (e) => { e.stopPropagation(); try { if (navigator.share) await navigator.share({ title: storyUser.displayName, text: `Story de ${storyUser.displayName}`, url: window.location.href }); else await navigator.clipboard?.writeText(window.location.href); } catch {} }} className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/65 bg-black/25 text-white backdrop-blur-sm" aria-label="Share story" data-testid="btn-story-share"><Share2 size={23} strokeWidth={2.2} /></button>
            <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/65 bg-black/25 px-4 py-2.5 backdrop-blur-sm">
              <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Envoyez un message..." className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-white outline-none placeholder:text-white/90" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} data-testid="input-story-reply" />
              {replyText.trim() && <button onClick={(e) => { e.stopPropagation(); void sendStoryReply(); }} className="ml-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white" aria-label="Send reply" data-testid="btn-send-reply"><Send size={17} strokeWidth={2.2} /></button>}
            </div>
            <div className="flex shrink-0 items-center gap-1">{reactionOptions.slice(0,3).map((reaction)=><button key={reaction} onClick={(e)=>{e.stopPropagation();chooseReaction(reaction)}} className="flex size-11 items-center justify-center rounded-full bg-white/10 text-[24px]" aria-label={`React ${reaction}`}>{reaction}</button>)}</div>
          </div>
          {currentStory.location && <div className="mx-1 mb-2 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-md"><MapPin size={16} strokeWidth={2}/><span>{currentStory.location}</span></div>}
        </div>}
        {isOwnStory && <div className="absolute inset-x-0 bottom-3 z-40 flex items-center gap-2 px-3">
          <button onClick={async (e)=>{e.stopPropagation();try{if(navigator.share)await navigator.share({title:storyUser.displayName,url:window.location.href});else await navigator.clipboard?.writeText(window.location.href)}catch{}}} className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/65 bg-black/25 text-white backdrop-blur-sm" aria-label="Share story" data-testid="btn-story-share"><Share2 size={23} strokeWidth={2.2}/></button>
          <button onClick={()=>void openViewers()} className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-white/65 bg-black/25 px-4 py-3 text-white backdrop-blur-sm" aria-label="View story viewers"><Eye size={19}/><span className="text-sm font-semibold">{viewCount} views</span></button>
        </div>}
        {showViewers && isOwnStory && <div className="absolute inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm" onClick={()=>setShowViewers(false)}><div className="max-h-[72%] w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-[#0d0c14] p-5" onClick={e=>e.stopPropagation()}><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20"/><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-white">{viewCount} views</h2><button onClick={()=>setShowViewers(false)} className="p-2 text-white/60"><X size={20}/></button></div><div className="max-h-[52vh] space-y-2 overflow-y-auto">{viewers.length===0?<p className="py-8 text-center text-white/45">No viewers yet.</p>:viewers.map(v=><div key={v.userId} className="flex items-center gap-3 rounded-2xl px-2 py-2.5"><img src={v.avatarUrl??`https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(v.displayName)}&backgroundColor=FF006E`} alt="" className="size-11 rounded-full object-cover ring-2 ring-fuchsia-500/70"/><div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{v.displayName}</p><p className="truncate text-xs text-white/45">@{v.username}</p></div><span className="text-2xl">{v.reaction??""}</span></div>)}</div></div></div>}
      </div>
    </div>
  );
}
