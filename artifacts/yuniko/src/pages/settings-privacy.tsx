import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n";
import { apiJson } from "@/lib/api";
import BottomNav from "@/components/BottomNav";

type Settings = { privateAccount:boolean; readReceipts:boolean; messagePermissions:string; commentPermissions:string; storyPermissions:string };
const OPTIONS=[["everyone","everyone"],["friendsOnly","friendsOnly"],["onlyMe","onlyMe"]] as const;
function Toggle({value,onChange}:{value:boolean;onChange:(v:boolean)=>void}){return <button aria-pressed={value} onClick={()=>onChange(!value)} className="relative w-10 h-6 rounded-full" style={{background:value?"linear-gradient(135deg,#FF006E,#8B00FF)":"rgba(255,255,255,.15)"}}><span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{left:value?"calc(100% - 22px)":"2px"}}/></button>}
export default function PrivacySettings(){
 const [,setLocation]=useLocation(); const [s,setS]=useState<Settings|null>(null); const [error,setError]=useState("");
 useEffect(()=>{apiJson<Settings>("/settings").then(setS).catch(e=>setError(e.message))},[]);
 const patch=async(values:Partial<Settings>)=>{if(!s)return; const previous=s; setError(""); setS({...s,...values}); try{await apiJson("/settings",{method:"PATCH",body:JSON.stringify(values)})}catch(e){setS(previous);setError(e instanceof Error?e.message:"Failed to save")}};
 if(!s)return <div className="min-h-screen bg-background text-white flex items-center justify-center">{error||"Loading..."}</div>;
 return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20"><header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{background:"rgba(13,11,20,.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,.06)"}}><button onClick={()=>setLocation("/settings")}><ArrowLeft size={22} className="text-white/80"/></button><h1 className="text-base font-semibold text-white">{t("privacy")}</h1></header>
 <div className="px-4 py-4 flex flex-col gap-4">{error&&<p className="text-red-400 text-xs">{error}</p>}
 <div><p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Account</p><div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)"}}>
 <div className="flex items-center gap-3 px-4 py-4"><div className="flex-1"><p className="text-white/85 text-sm font-medium">{t("privateAccount")}</p><p className="text-white/40 text-xs mt-0.5">Only approved followers can see your posts.</p></div><Toggle value={s.privateAccount} onChange={v=>patch({privateAccount:v})}/></div>
 <div className="flex items-center gap-3 px-4 py-4" style={{borderTop:"1px solid rgba(255,255,255,.06)"}}><div className="flex-1"><p className="text-white/85 text-sm font-medium">{t("readReceipts")}</p><p className="text-white/40 text-xs mt-0.5">Let others know when you have read messages.</p></div><Toggle value={s.readReceipts} onChange={v=>patch({readReceipts:v})}/></div>
 </div></div>
 <div><p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Permissions</p><div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)"}}>{([["messagePermissions","Message permissions"],["commentPermissions","Comment permissions"],["storyPermissions","Story permissions"]] as const).map(([key,label],i)=><div key={key} className="flex items-center gap-3 px-4 py-4" style={{borderTop:i?"1px solid rgba(255,255,255,.06)":"none"}}><div className="flex-1"><p className="text-white/85 text-sm font-medium">{t(key as any)||label}</p></div><select value={s[key]} onChange={e=>patch({[key]:e.target.value} as Partial<Settings>)} className="bg-transparent text-sm outline-none" style={{color:"#FF3D9A"}}>{OPTIONS.map(([value,labelKey])=><option key={value} value={value} style={{background:"#1E1433"}}>{t(labelKey as any)}</option>)}</select></div>)}</div></div>
 <button onClick={()=>setLocation("/blocked-users")} className="flex items-center gap-3 px-4 py-4 rounded-2xl" style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)"}}><span className="flex-1 text-white/85 text-sm">{t("blockedUsers")}</span><ChevronRight size={16} className="text-white/30"/></button>
 </div><BottomNav/></div>;
}
