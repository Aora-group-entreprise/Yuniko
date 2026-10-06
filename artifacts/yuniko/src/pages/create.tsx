import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { X, Image as ImageIcon, MapPin, Hash, Globe, Camera, Sparkles, Smile, Type, Send, Clock3 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import BottomNav from "@/components/BottomNav";
import { apiFetch } from "@/lib/api";
import { invalidateSessionCache } from "@/lib/session-cache";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

// Compress & crop uploaded image to max 1080px wide, JPEG 0.82
async function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1080;
        const scale = img.width > MAX ? MAX / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas error")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function applyImageFilter(dataUrl: string, filter: "Original" | "Warm" | "Cool" | "Moody"): Promise<string> {
  if (filter === "Original") return dataUrl;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas error")); return; }
      const filters = { Warm: "saturate(1.12) sepia(0.16) brightness(1.04)", Cool: "saturate(1.05) hue-rotate(8deg) brightness(1.03)", Moody: "contrast(1.14) saturate(0.78) brightness(0.88)" } as const;
      ctx.filter = filters[filter]; ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    img.onerror = reject; img.src = dataUrl;
  });
}

async function applyStorySticker(dataUrl: string, sticker: string | null): Promise<string> {
  if (!sticker) return dataUrl;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas error")); return; }
      ctx.drawImage(img, 0, 0);
      const size = Math.max(48, Math.round(Math.min(canvas.width, canvas.height) * 0.16));
      ctx.font = `${size}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = Math.max(4, Math.round(size * 0.12));
      ctx.fillText(sticker, canvas.width / 2, canvas.height / 2);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    img.onerror = reject; img.src = dataUrl;
  });
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

type TabMode = "post" | "story";

export default function Create() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabMode>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("mode");
      return p === "story" ? "story" : "post";
    }
    return "post";
  });

  const [caption, setCaption] = useState("");
  const [isWorldFeed, setIsWorldFeed] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaFilter, setMediaFilter] = useState<"Original" | "Warm" | "Cool" | "Moody">("Original");
  const [storySticker, setStorySticker] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [locationText, setLocationText] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [posted, setPosted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("mode");
    setActiveTab(p === "story" ? "story" : "post");
  }, []);

  const avatarSrc =
    user?.avatarUrl ??
    `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user?.displayName ?? "U")}&backgroundColor=FF006E`;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processImage(file);
      setSelectedMedia(dataUrl);
      setMediaFilter("Original"); setStorySticker(null); setShowStickerPicker(false);
      setError("");
    } catch {
      setError("Could not process image. Please try another.");
    }
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (activeTab === "story") {
      if (!selectedMedia) { setError("Please add a photo for your story"); return; }
    } else {
      if (!caption.trim() && !selectedMedia) { setError("Add a caption or photo"); return; }
    }

    if (!user) { setError("Please log in first"); return; }

    setLoading(true);
    setError("");
    try {
      const filteredMedia = selectedMedia ? await applyImageFilter(selectedMedia, mediaFilter) : null;
      const mediaForSubmit = filteredMedia ? await applyStorySticker(filteredMedia, activeTab === "story" ? storySticker : null) : null;
      if (activeTab === "story") {
        const r = await apiFetch("/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaUrl: mediaForSubmit, caption: caption.trim() }),
        });
        const d = await r.json() as { story?: any; error?: string };
        if (!r.ok) { setError(d.error ?? "Failed to post story"); return; }

        // The Home page caches /stories in the session cache. Invalidate it
        // immediately so the newly-created story is fetched from the API.
        invalidateSessionCache("/stories");
      } else {
        const r = await apiFetch("/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caption: caption.trim(),
            mediaUrl: mediaForSubmit,
            location: locationText.trim() || undefined,
            hashtags: hashtags.trim() || undefined,
            isWorldFeed,
          }),
        });
        const d = await r.json() as { post?: any; error?: string };
        if (!r.ok) { setError(d.error ?? "Failed to post"); return; }
      }
      setPosted(true);
      setTimeout(() => setLocation("/"), 1400);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (posted) {
    return (
      <div
        className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-5"
        style={{ background: "hsl(250, 30%, 7%)" }}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 18, stiffness: 280 }}
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: GRADIENT, boxShadow: "0 0 50px rgba(255,0,110,0.4)" }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-white font-semibold text-xl"
        >
          {activeTab === "story" ? "Story posted!" : "Posted!"}
        </motion.p>
      </div>
    );
  }

  const canSubmit = activeTab === "story" ? !!selectedMedia : !!(caption.trim() || selectedMedia);

  return (
    <div className="relative mx-auto min-h-[var(--yuniko-vh)] w-full max-w-[430px] overflow-x-hidden pb-28 text-white" style={{ background: "#050509" }}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div
        className="pointer-events-none fixed inset-y-0 left-0 right-0 mx-auto w-full max-w-[430px] opacity-80"
        style={{ background: "radial-gradient(ellipse 70% 45% at 0% 35%,rgba(255,20,147,.13),transparent 68%),radial-gradient(ellipse 65% 45% at 100% 58%,rgba(0,140,255,.14),transparent 68%)" }}
      />

      <header className="relative z-20 px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setLocation("/")} aria-label="Close create">
            <X size={27} className="text-white/75" strokeWidth={1.8} />
          </button>
          <div
            className="text-[30px] font-black tracking-[-0.06em]"
            style={{ background: "linear-gradient(90deg,#FF1493,#8B5CFF,#008CFF)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}
          >
            ✦ Yuniko
          </div>
          <motion.button
            whileTap={{ scale:.92 }}
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-45"
            style={{ background: canSubmit ? "linear-gradient(135deg,#FF1493,#008CFF)" : "rgba(255,255,255,.09)", boxShadow: canSubmit ? "0 0 18px rgba(255,20,147,.28)" : "none" }}
          >
            {loading ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : activeTab === "story" ? "Share" : "Post"}
          </motion.button>
        </div>

        <div className="mt-5 flex h-[54px] rounded-full p-1.5" style={{ background:"rgba(255,255,255,.10)", boxShadow:"inset 0 0 0 1px rgba(255,255,255,.035)" }}>
          {(["post","story"] as TabMode[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setError(""); }}
              className="relative flex-1 rounded-full text-[18px] font-bold"
              style={{ color: activeTab===tab ? "#fff" : "rgba(255,255,255,.42)", background: activeTab===tab ? "linear-gradient(135deg,rgba(255,20,147,.98),rgba(0,140,255,.98))" : "transparent", boxShadow: activeTab===tab ? "0 0 22px rgba(255,20,147,.18)" : "none" }}
            >
              {tab === "post" ? "Post" : "Story"}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 px-5">
        <section className="mb-5">
          <div className="mb-3 flex items-center gap-2.5">
            <Camera size={21} style={{ color:"#FF43B0" }} />
            <span className="text-[18px] font-bold" style={{ background:"linear-gradient(90deg,#FF43B0,#8B5CFF,#008CFF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>
              {activeTab === "story" ? "STORY" : "POST"}
            </span>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative block w-full overflow-hidden rounded-[24px] text-left"
            style={{ minHeight: activeTab === "story" ? "360px" : "245px", background:"linear-gradient(145deg,rgba(255,20,147,.09),rgba(0,140,255,.08))", border:"1px solid rgba(255,20,147,.35)", boxShadow:"0 0 22px rgba(255,20,147,.10),inset 0 0 30px rgba(0,140,255,.035)" }}
          >
            {selectedMedia ? (
              <>
                <img src={selectedMedia} alt="Selected media" className="absolute inset-0 h-full w-full object-cover" style={{filter:mediaFilter==="Warm"?"saturate(1.12) sepia(.16) brightness(1.04)":mediaFilter==="Cool"?"saturate(1.05) hue-rotate(8deg) brightness(1.03)":mediaFilter==="Moody"?"contrast(1.14) saturate(.78) brightness(.88)":"none"}} />
                {storySticker && activeTab==="story" && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,.45)]">{storySticker}</div>}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/45">
                <ImageIcon size={42} />
                <span className="text-sm font-medium">Add a photo</span>
              </div>
            )}
            {selectedMedia && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedMedia(null); setMediaFilter("Original"); setStorySticker(null); setShowStickerPicker(false); }}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60"
                aria-label="Remove photo"
              >
                <X size={17} />
              </button>
            )}
          </button>
        </section>

        <section className="mb-5 flex gap-2.5 overflow-x-auto no-scrollbar">
          {(activeTab === "post"
            ? [
                {label:"Original",icon:<Sparkles size={18}/>,filter:"Original" as const},
                {label:"Warm",icon:<Sparkles size={18}/>,filter:"Warm" as const},
                {label:"Cool",icon:<Sparkles size={18}/>,filter:"Cool" as const},
                {label:"Moody",icon:<Sparkles size={18}/>,filter:"Moody" as const},
              ]
            : [
                {label:"Text",icon:<Type size={18}/>,filter:undefined,sticker:false,filterTool:false},
                {label:"Stickers",icon:<Smile size={18}/>,filter:undefined,sticker:true,filterTool:false},
                {label:"Filters",icon:<Sparkles size={18}/>,filter:undefined,sticker:false,filterTool:true},
              ]
          ).map((tool,index) => (
            <button key={tool.label} onClick={() => {
              if (tool.filter) setMediaFilter(tool.filter);
              else if (tool.label === "Text") document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
              else if (tool.sticker) setShowStickerPicker((value) => !value);
              else if (tool.filterTool) setMediaFilter(mediaFilter === "Original" ? "Warm" : "Original");
            }} className="flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-semibold" style={{background:(tool.filter === mediaFilter || (tool.sticker && showStickerPicker))?"linear-gradient(135deg,#FF1493,#008CFF)":"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.10)",color:"#fff"}}>
              {tool.icon}{tool.label}
            </button>
          ))}       </section>

        <section className="rounded-[22px] p-4 mb-5" style={{ background:"rgba(8,8,14,.78)", border:"1px solid rgba(255,20,147,.24)", boxShadow:"0 0 18px rgba(0,140,255,.06)" }}>
          <div className="flex items-start gap-3">
            <img src={avatarSrc} alt={user?.username ?? ""} className="h-11 w-11 shrink-0 rounded-full object-cover" style={{ boxShadow:"0 0 0 2px rgba(255,20,147,.65),0 0 12px rgba(0,140,255,.22)" }} />
            <textarea
              value={caption}
              onChange={(e)=>setCaption(e.target.value)}
              placeholder={activeTab === "story" ? "Write on your story..." : "Write a caption... #wanderlust #nature"}
              className="min-h-[74px] flex-1 resize-none bg-transparent text-[16px] leading-6 text-white outline-none placeholder:text-white/35"
              rows={3}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-white/35">
            <span>{caption.length}/500</span>
            {activeTab === "post" && <span className="text-white/45">Public</span>}
          </div>
        </section>

        {activeTab === "post" && (
          <section className="mb-5 rounded-[22px] overflow-hidden" style={{ background:"rgba(8,8,14,.76)", border:"1px solid rgba(255,255,255,.08)" }}>
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom:"1px solid rgba(255,255,255,.06)" }}>
              <MapPin size={20} style={{color:"#FF43B0"}} />
              <input value={locationText} onChange={(e)=>setLocationText(e.target.value)} placeholder="Add location" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom:"1px solid rgba(255,255,255,.06)" }}>
              <Hash size={20} className="text-blue-400" />
              <input value={hashtags} onChange={(e)=>setHashtags(e.target.value)} placeholder="#hashtags" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35" />
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Globe size={20} style={{color:"#FF43B0"}} />
              <span className="flex-1 text-sm text-white/80">World Feed</span>
              <Toggle value={isWorldFeed} onChange={setIsWorldFeed} />
            </div>
          </section>
        )}

        {activeTab === "story" && (
          <section className="mb-5">
            <div className="mb-3 flex items-center gap-3">
              <Clock3 size={21} style={{color:"#8B5CFF"}} />
              <span className="font-bold" style={{color:"#FF43B0"}}>STORY</span>
            </div>
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full p-[4px]" style={{background:"conic-gradient(#FF1493 0 55%,#008CFF 55% 78%,rgba(255,255,255,.12) 78% 100%)",boxShadow:"0 0 25px rgba(255,20,147,.22)"}}>
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#050509] text-center text-sm font-bold">15s</div>
            </div>
            <p className="mt-3 text-center text-sm text-white/45">Story disappears after 24h</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => setMediaFilter(mediaFilter === "Original" ? "Warm" : "Original")} className="flex h-20 flex-col items-center justify-center gap-2 rounded-2xl text-sm font-semibold" style={{background:mediaFilter !== "Original" ? "linear-gradient(135deg,rgba(255,20,147,.35),rgba(0,140,255,.25))" : "rgba(255,20,147,.05)",border:"1px solid rgba(139,92,255,.35)",color:"#FF7AC7"}}><Sparkles size={22}/>Filters</button>
              <button onClick={() => setShowStickerPicker((value) => !value)} className="flex h-20 flex-col items-center justify-center gap-2 rounded-2xl text-sm font-semibold" style={{background:showStickerPicker ? "linear-gradient(135deg,rgba(255,20,147,.35),rgba(0,140,255,.25))" : "rgba(255,20,147,.05)",border:"1px solid rgba(139,92,255,.35)",color:"#FF7AC7"}}><Smile size={22}/>Stickers</button>
            </div>
            {showStickerPicker && <div className="mt-3 flex items-center justify-center gap-3 rounded-2xl p-3" style={{background:"rgba(8,8,14,.82)",border:"1px solid rgba(139,92,255,.25)"}}>{["❤️","✨","🌍","😊","🔥"].map((sticker)=><button key={sticker} onClick={()=>{setStorySticker(storySticker===sticker?null:sticker);setShowStickerPicker(false)}} className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl hover:bg-white/10" aria-label={sticker}>{sticker}</button>)}</div>}
          </section>
        )}

        {error && <p className="mb-4 text-center text-xs text-red-400">{error}</p>}

        <motion.button
          whileTap={{scale:.98}}
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-[22px] py-4 text-[20px] font-bold text-white disabled:opacity-45"
          style={{background:canSubmit?"linear-gradient(135deg,#FF1493,#008CFF)":"rgba(255,255,255,.10)",boxShadow:canSubmit?"0 0 26px rgba(255,20,147,.28)":"none"}}
        >
          {activeTab==="story" ? <Send size={23}/> : <Send size={23}/>}
          {activeTab==="story" ? "Share" : "Post"}
        </motion.button>
      </main>

      <BottomNav />

    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <motion.button
      onClick={() => onChange(!value)}
      className="relative w-10 h-6 rounded-full flex-shrink-0"
      style={{ background: value ? GRADIENT : "rgba(255,255,255,0.15)" }}
    >
      <motion.span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
        animate={{ left: value ? "calc(100% - 22px)" : "2px" }}
        transition={{ type: "spring", damping: 22, stiffness: 400 }}
      />
    </motion.button>
  );
}
