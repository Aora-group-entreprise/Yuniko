import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n";
import { apiJson } from "@/lib/api";
import BottomNav from "@/components/BottomNav";
type S={pushNotifications:boolean;emailNotifications:boolean};
function Toggle({value,onChange}:{value:boolean;onChange:(v:boolean)=>void}){return <button type="button" aria-pressed={value} onClick={()=>onChange(!value)} className="relative w-10 h-6 rounded-full" style={{background:value?"linear-gradient(135deg,#FF006E,#8B00FF)":"rgba(255,255,255,.15)"}}><span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{left:value?"calc(100% - 22px)":"2px"}}/></button>}
export default function NotificationSettings(){
 const [,setLocation]=useLocation(); const [s,setS]=useState<S|null>(null);
 useEffect(()=>{apiJson<S>("/settings").then(setS)},[]);
 const patch=async(k:keyof S,v:boolean)=>{if(!s)return;const old=s;setS({...s,[k]:v});try{await apiJson("/settings",{method:"PATCH",body:JSON.stringify({[k]:v})})}catch{setS(old)}};
 if(!s)return <div className="min-h-screen bg-background text-white flex items-center justify-center">Loading...</div>;
 return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20"><header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{background:"rgba(13,11,20,.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,.06)"}}><button onClick={()=>setLocation("/settings")}><ArrowLeft size={22} className="text-white/80"/></button><h1 className="text-base font-semibold text-white">Notifications</h1></header>
 <div className="px-4 py-4"><div className="rounded-2xl overflow-hidden" style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)"}}>
 <div className="flex items-center gap-3 px-4 py-4"><div className="flex-1"><p className="text-white/85 text-sm font-medium">Push notifications</p><p className="text-white/40 text-xs mt-0.5">Likes, comments, messages and follows</p></div><Toggle value={s.pushNotifications} onChange={v=>patch("pushNotifications",v)}/></div>
 <div className="flex items-center gap-3 px-4 py-4" style={{borderTop:"1px solid rgba(255,255,255,.06)"}}><div className="flex-1"><p className="text-white/85 text-sm font-medium">Email notifications</p><p className="text-white/40 text-xs mt-0.5">Important account and security emails</p></div><Toggle value={s.emailNotifications} onChange={v=>patch("emailNotifications",v)}/></div>
 </div></div><BottomNav/></div>;
}