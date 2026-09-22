import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, UserX } from "lucide-react";
import { t } from "@/lib/i18n";
import { apiJson } from "@/lib/api";
import BottomNav from "@/components/BottomNav";
type Blocked={id:number;username:string;displayName:string;avatarUrl:string|null;countryFlag:string|null};
export default function BlockedUsers(){
 const [,setLocation]=useLocation(); const [blocked,setBlocked]=useState<Blocked[]>([]); const [loading,setLoading]=useState(true);
 useEffect(()=>{apiJson<{users:Blocked[]}>("/blocked-users").then(r=>setBlocked(r.users)).finally(()=>setLoading(false))},[]);
 const unblock=async(id:number)=>{await apiJson("/blocked-users/"+id,{method:"DELETE"});setBlocked(x=>x.filter(u=>u.id!==id))};
 return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20"><header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{background:"rgba(13,11,20,.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,.06)"}}><button onClick={()=>setLocation("/settings")}><ArrowLeft size={22} className="text-white/80"/></button><h1 className="text-base font-semibold text-white">{t("blockedUsers")}</h1></header>
 <div className="px-4 py-4"><p className="text-white/40 text-sm mb-4">Blocked users cannot contact you or interact with your account.</p>
 {loading?<p className="text-white/40 text-sm text-center py-12">Loading...</p>:blocked.length===0?<div className="flex flex-col items-center justify-center py-16 gap-3"><UserX size={40} className="text-white/20"/><p className="text-white/40 text-sm">No blocked users</p></div>:blocked.map(u=><div key={u.id} className="flex items-center gap-3 py-3" style={{borderBottom:"1px solid rgba(255,255,255,.05)"}}><img src={u.avatarUrl||`https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(u.displayName)}`} alt="" className="w-11 h-11 rounded-full object-cover"/><div className="flex-1"><p className="text-white font-semibold text-sm">{u.displayName}</p><p className="text-white/40 text-xs">@{u.username}</p></div><button onClick={()=>unblock(u.id)} className="px-4 py-1.5 rounded-full text-sm font-semibold text-white" style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)"}}>{t("unblock")}</button></div>)}
 </div><BottomNav/></div>;
}