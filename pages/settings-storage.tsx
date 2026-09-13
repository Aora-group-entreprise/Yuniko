import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, HardDrive, Trash2, Check } from "lucide-react";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

const CACHE_PREFIXES = ["yuniko_cache:", "yuniko_query:", "yuniko_feed:", "yuniko_draft:"];
const CACHE_KEYS = new Set(["yuniko_search_cache", "yuniko_notifications_cache"]);

function isCacheKey(key: string) {
  return CACHE_KEYS.has(key) || CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export default function StorageSettings(){const[,setLocation]=useLocation();const[cleared,setCleared]=useState(false);const handleClearCache=()=>{try{Object.keys(localStorage).forEach(k=>{if(isCacheKey(k))localStorage.removeItem(k)});if("caches" in window){void caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("yuniko-cache" )).map(k=>caches.delete(k))))}setCleared(true);setTimeout(()=>setCleared(false),2000)}catch{setCleared(false)}};return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20"><header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{background:"rgba(13,11,20,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}><button onClick={()=>setLocation("/settings")} data-testid="btn-back-storage"><ArrowLeft size={22} className="text-white/80"/></button><h1 className="text-base font-semibold text-white">{t("storage")}</h1></header><div className="px-4 py-4 flex flex-col gap-4"><div className="p-4 rounded-2xl" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}><div className="flex items-center gap-2 mb-2"><HardDrive size={16} className="text-pink-400"/><span className="text-white font-semibold text-sm">App Storage</span></div><p className="text-white/40 text-sm">Exact storage usage is provided by the device/browser. Yuniko does not display fabricated storage numbers.</p></div><div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}><button onClick={handleClearCache} className="w-full flex items-center gap-3 px-4 py-4" data-testid="btn-clear-cache"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:"rgba(239,68,68,0.15)"}}>{cleared?<Check size={16} className="text-green-400"/>:<Trash2 size={16} className="text-red-400"/>}</div><div className="flex-1 text-left"><p className="text-white/85 text-sm font-medium">{cleared?"Local cache cleared":"Clear local cache"}</p><p className="text-white/40 text-xs mt-0.5">Removes only Yuniko cache entries; authentication and account data are kept.</p></div></button></div></div><BottomNav/></div>}
