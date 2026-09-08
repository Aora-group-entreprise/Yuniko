import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { X, Send, MoreHorizontal, BadgeCheck, Trash2 } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👏"];
const STORY_DURATION_MS = 7000;
type Story = { id:number; userId:number; mediaUrl:string; caption:string; createdAt:string; authorDisplayName:string; authorUsername:string; authorAvatarUrl:string|null; verificationStatus?:string; viewed?:boolean; mediaType?:string };

export default function StoryViewer() {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const { user: me } = useAuth();
  const routeId = params?.userId ?? "";
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [reactionShown, setReactionShown] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStories([]);
    setCurrentIndex(0);
    setProgress(0);
    (async () => {
      try {
        const data = await apiJson<{stories:Story[]}>("/stories");
        if (cancelled) return;
        const numeric = routeId.startsWith("live_") ? Number(routeId.slice(5)) : Number(routeId);
        const targetUserId = routeId.startsWith("live_") ? data.stories.find(s => s.id === numeric)?.userId : numeric;
        setStories(data.stories.filter(s => s.userId === targetUserId));
      } catch {
        if (!cancelled) setStories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [routeId]);

  const currentStory = stories[currentIndex];
  useEffect(() => {
    if (!currentStory || paused) return;
    startedAtRef.current = Date.now();
    intervalRef.current = window.setInterval(() => {
      const nextProgress = Math.min(100, ((Date.now() - startedAtRef.current) / STORY_DURATION_MS) * 100);
      setProgress(nextProgress);
      if (nextProgress >= 100) {
        if (currentIndex < stories.length - 1) { setCurrentIndex(i => i + 1); setProgress(0); }
        else setLocation("/");
      }
    }, 50);
    return () => { if (intervalRef.current !== null) window.clearInterval(intervalRef.current); intervalRef.current = null; };
  }, [currentIndex, paused, stories.length, currentStory, setLocation]);

  useEffect(() => { if (currentStory) apiJson(`/stories/${currentStory.id}/view`, { method:"POST" }).catch(() => undefined); }, [currentStory?.id]);
  const goNext = () => currentIndex < stories.length - 1 ? (setCurrentIndex(i => i + 1), setProgress(0)) : setLocation("/");
  const goPrev = () => { if (currentIndex > 0) { setCurrentIndex(i => i - 1); setProgress(0); } };
  const handleReaction = (emoji:string) => { setReactionShown(emoji); if (currentStory) apiJson(`/stories/${currentStory.id}/reaction`, { method:"POST", body:JSON.stringify({emoji}) }).catch(() => {}); window.setTimeout(() => setReactionShown(null), 1500); };
  const sendReply = async () => { const text = replyText.trim(); if (!text || !currentStory) return; await apiJson(`/stories/${currentStory.id}/replies`, { method:"POST", body:JSON.stringify({text}) }).catch(() => {}); setReplyText(""); };
  const deleteStory = async () => {
    if (!currentStory || currentStory.userId !== me?.id || deleting) return;
    setDeleting(true);
    const storyId = currentStory.id;
    const previousStories = stories;
    const remaining = previousStories.filter(s => s.id !== storyId);
    const nextIndex = Math.min(currentIndex, Math.max(0, remaining.length - 1));
    try {
      const result = await apiJson<{success:boolean}>(`/stories/${storyId}`, {method:"DELETE"});
      if (!result.success) throw new Error("Story deletion failed");
      setStories(remaining);
      setCurrentIndex(nextIndex);
      setProgress(0);
      setShowMenu(false);
      if (!remaining.length) setLocation("/");
    } catch {
      setStories(previousStories);
    } finally { setDeleting(false); }
  };

  if (loading) return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-black flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-pink-500 animate-spin" aria-label={t("loading")} /></div>;
  if (!currentStory) return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-black flex items-center justify-center"><div className="text-center"><p className="text-white/50">{t("noStories")}</p><button onClick={() => setLocation("/")} className="mt-4" style={{color:"#FF3D9A"}}>{t("back")}</button></div></div>;
  const avatar = currentStory.authorAvatarUrl ?? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(currentStory.authorDisplayName)}&backgroundColor=FF006E`;
  const verified = currentStory.verificationStatus === "approved";
  const own = currentStory.userId === me?.id;
  return <div className="w-full max-w-[430px] mx-auto min-h-screen relative overflow-hidden bg-black" data-testid="story-viewer">
    {currentStory.mediaType === "video" ? <video src={currentStory.mediaUrl} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} /> : <img src={currentStory.mediaUrl} alt={currentStory.caption || "Story"} className="absolute inset-0 w-full h-full object-cover" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} />}
    <div className="absolute inset-0 flex z-10"><div className="flex-1" onClick={goPrev}/><div className="flex-1" onClick={goNext}/></div>
    <div className="absolute top-4 left-3 right-3 z-20 flex gap-1">{stories.map((_,i) => <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-white/30"><div className="h-full bg-white/90" style={{width:i<currentIndex?"100%":i===currentIndex?`${progress}%`:"0%"}} /></div>)}</div>
    <div className="absolute top-10 left-3 right-3 z-20 flex items-center justify-between"><button aria-label={currentStory.authorDisplayName} onClick={() => setLocation(`/user/${currentStory.userId}`)} className="flex items-center gap-2"><img src={avatar} alt={currentStory.authorDisplayName} className="w-9 h-9 rounded-full object-cover border-2 border-pink-500"/><div><div className="flex items-center gap-1"><span className="text-white font-semibold text-sm">{currentStory.authorDisplayName}</span>{verified && <BadgeCheck aria-label="Verified" size={13} className="text-blue-300"/>}</div><span className="text-white/60 text-xs">{new Date(currentStory.createdAt).toLocaleDateString()}</span></div></button><div className="relative flex gap-3"><button aria-label={t("more")} onClick={() => setShowMenu(v => !v)}><MoreHorizontal size={22} className="text-white"/></button>{showMenu && own && <div className="absolute right-0 top-8 w-44 rounded-xl bg-[#181326] border border-white/10 shadow-2xl overflow-hidden"><button onClick={deleteStory} disabled={deleting} className="w-full px-4 py-3 flex items-center gap-2 text-left text-red-400 text-sm"><Trash2 size={16}/>{deleting ? "Deleting…" : t("delete")}</button></div>}<button aria-label={t("close")} onClick={() => setLocation("/")}><X size={22} className="text-white"/></button></div></div>
    {reactionShown && <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"><span className="text-7xl animate-bounce">{reactionShown}</span></div>}
    <div className="absolute bottom-24 left-3 right-3 z-20 flex justify-center gap-3">{QUICK_REACTIONS.map(e => <button aria-label={e} key={e} onClick={() => handleReaction(e)} className="text-2xl p-1 rounded-full bg-white/10">{e}</button>)}</div>
    <div className="absolute bottom-6 left-3 right-3 z-20 flex items-center gap-2"><div className="flex-1 flex items-center px-4 py-2.5 rounded-full bg-white/10 border border-white/20"><input value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendReply()} placeholder={`Reply to ${currentStory.authorDisplayName}...`} aria-label={t("reply")} className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/50"/></div>{replyText && <button aria-label={t("send")} onClick={sendReply} className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-600"><Send size={16} className="text-white"/></button>}</div>
  </div>;
}
