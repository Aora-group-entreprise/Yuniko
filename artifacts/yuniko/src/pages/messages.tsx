import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Search, Edit, UserPlus, Archive, Phone, MessageSquarePlus } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { t } from "@/lib/i18n";
import { apiJson } from "@/lib/api";
import ScreenPortal from "@/components/ScreenPortal";

type Conversation = {
  id: number;
  user: { id:number; username:string; displayName:string; avatarUrl:string|null; verified:boolean };
  lastMessage: string;
  lastMessageTime: string|null;
  unread: number;
};

const GRADIENT="linear-gradient(135deg,#FF006E 0%,#8B00FF 100%)";

function formatTime(value:string|null){
  if(!value) return "";
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return "";
  const now=Date.now(), diff=now-date.getTime();
  if(diff<60_000) return "now";
  if(diff<3_600_000) return Math.floor(diff/60_000)+"m";
  if(diff<86_400_000) return Math.floor(diff/3_600_000)+"h";
  return date.toLocaleDateString([], {day:"2-digit",month:"2-digit"});
}

export default function Messages(){
  const [,setLocation]=useLocation();
  const [query,setQuery]=useState("");
  const [showNewMsg,setShowNewMsg]=useState(false);
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=()=>{
    setLoading(true); setError(null);
    void apiJson<{conversations:Conversation[]}>("/messages/conversations")
      .then(data=>setConversations(data.conversations??[]))
      .catch(err=>setError(err instanceof Error?err.message:"Unable to load messages"))
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return conversations;
    return conversations.filter(c=>c.user.displayName.toLowerCase().includes(q)||c.user.username.toLowerCase().includes(q)||c.lastMessage.toLowerCase().includes(q));
  },[conversations,query]);
  const totalUnread=conversations.reduce((sum,c)=>sum+c.unread,0);

  return <div className="w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] min-h-0 bg-background flex flex-col overflow-hidden">
    <header className="relative z-40 shrink-0 px-4 py-4 flex items-center justify-between" style={{background:"rgba(13,11,20,0.96)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)"}} data-testid="messages-header">
      <div className="flex items-center gap-2"><h1 className="text-lg font-bold text-white">{t("messages")}</h1>{totalUnread>0&&<span className="text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center" style={{background:GRADIENT}}>{totalUnread}</span>}</div>
      <div className="flex items-center gap-3">
        <button onClick={()=>setLocation("/message-requests")} data-testid="btn-message-requests"><UserPlus size={20} className="text-white/70" strokeWidth={1.8}/></button>
        <button onClick={()=>setLocation("/archived-chats")} data-testid="btn-archived"><Archive size={20} className="text-white/70" strokeWidth={1.8}/></button>
        <button onClick={()=>setLocation("/call-history")} data-testid="btn-call-history"><Phone size={20} className="text-white/70" strokeWidth={1.8}/></button>
        <button onClick={()=>setShowNewMsg(true)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{background:GRADIENT}} data-testid="btn-new-message"><Edit size={14} className="text-white"/></button>
      </div>
    </header>
    <div className="flex-1 min-h-0 overflow-y-auto pb-24">
      <div className="px-4 py-3"><div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <Search size={16} className="text-white/40 flex-shrink-0"/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("searchUsers")} className="flex-1 bg-transparent text-white/80 text-sm outline-none placeholder:text-white/30" data-testid="input-search-messages"/>
      </div></div>
      <div data-testid="conversations-list">
        {loading?<div className="flex justify-center py-20 text-white/40 text-sm">Loading...</div>:error?<div className="flex flex-col items-center py-20 gap-3"><p className="text-red-300/70 text-sm text-center px-6">{error}</p><button onClick={load} className="text-white text-sm px-4 py-2 rounded-xl" style={{background:GRADIENT}}>Retry</button></div>:filtered.length===0?<div className="flex flex-col items-center justify-center py-20 gap-4"><div className="w-16 h-16 rounded-full flex items-center justify-center" style={{background:"rgba(255,0,110,0.1)",border:"1px solid rgba(255,0,110,0.2)"}}><MessageSquarePlus size={28} style={{color:"#FF3D9A"}}/></div><p className="text-white/40 text-sm">{query?t("noMessages"):"Follow each other to become friends and start chatting."}</p></div>:filtered.map(conv=><button key={conv.id} onClick={()=>setLocation(`/chat/${conv.user.id}`)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/5" style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}} data-testid={`conversation-${conv.id}`}>
          <div className="relative flex-shrink-0"><img src={conv.user.avatarUrl??`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(conv.user.displayName)}`} alt={conv.user.displayName} className="w-12 h-12 rounded-full object-cover"/></div>
          <div className="flex-1 min-w-0"><div className="flex items-center justify-between"><span className={`font-semibold text-sm ${conv.unread>0?"text-white":"text-white/80"}`}>{conv.user.displayName}</span><span className="text-xs flex-shrink-0 ml-2" style={{color:conv.unread>0?"#FF3D9A":"rgba(255,255,255,0.35)"}}>{formatTime(conv.lastMessageTime)}</span></div>
            <div className="flex items-center justify-between mt-0.5"><p className={`text-sm truncate ${conv.unread>0?"text-white/80 font-medium":"text-white/40"}`}>{conv.lastMessage||"No messages yet"}</p>{conv.unread>0&&<span className="ml-2 min-w-[20px] h-5 px-1 rounded-full text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0" style={{background:GRADIENT}}>{conv.unread}</span>}</div>
          </div>
        </button>)}
      </div>
    </div>
    <BottomNav/>
    {showNewMsg&&<ScreenPortal><><div className="fixed inset-0 z-50 bg-black/60" onClick={()=>setShowNewMsg(false)}/><div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-2xl overflow-hidden" style={{background:"rgba(18,15,30,0.98)",border:"1px solid rgba(255,0,110,0.15)"}}>
      <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1"/><p className="text-white font-semibold text-sm px-5 py-3">Friends</p>
      {conversations.map(conv=><button key={conv.id} onClick={()=>{setShowNewMsg(false);setLocation(`/chat/${conv.user.id}`);}} className="w-full flex items-center gap-3 px-5 py-3.5" style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <img src={conv.user.avatarUrl??`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(conv.user.displayName)}`} alt={conv.user.displayName} className="w-10 h-10 rounded-full object-cover"/>
        <div className="text-left"><p className="text-white font-medium text-sm">{conv.user.displayName}</p><p className="text-white/40 text-xs">@{conv.user.username}</p></div>
      </button>)}
      <div className="h-6"/>
    </div></></ScreenPortal>}
  </div>;
}
