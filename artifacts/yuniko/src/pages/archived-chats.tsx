import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Archive, RotateCcw } from "lucide-react";
import { t } from "@/lib/i18n";
import { apiJson } from "@/lib/api";
import BottomNav from "@/components/BottomNav";
import { LoadingSkeleton } from "@/components/ui/skeleton";

type ArchivedConversation={
  id:number;
  user:{id:number;username:string;displayName:string;avatarUrl:string|null;verified:boolean};
  lastMessage:string;
  lastMessageTime:string|null;
  archivedAt:string|null;
};

export default function ArchivedChats(){
  const [,setLocation]=useLocation();
  const [conversations,setConversations]=useState<ArchivedConversation[]>([]);
  const [loading,setLoading]=useState(true);

  const load=()=>{
    setLoading(true);
    void apiJson<{conversations:ArchivedConversation[]}>("/messages/archived")
      .then(data=>setConversations(data.conversations??[]))
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);

  const unarchive=async(id:number)=>{
    setConversations(current=>current.filter(c=>c.id!==id));
    try{await apiJson("/messages/conversations/"+id+"/archive",{method:"DELETE"});}
    catch{load();}
  };

  return <div className="w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] min-h-0 bg-background flex flex-col overflow-hidden">
    <header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{background:"rgba(13,11,20,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)"}} data-testid="archived-header">
      <button onClick={()=>setLocation("/messages")} data-testid="btn-back-archived"><ArrowLeft size={22} className="text-white/80"/></button>
      <h1 className="text-base font-semibold text-white">{t("archivedChats")}</h1>
    </header>
    <div className="flex-1 overflow-y-auto pb-24">
      {loading?<LoadingSkeleton variant="list" />:conversations.length===0?<div className="flex flex-col items-center justify-center py-24 gap-3"><Archive size={48} className="text-white/20"/><p className="text-white/40 text-sm">No archived chats</p></div>:conversations.map(conv=><div key={conv.id} className="flex items-center gap-3 px-4 py-3.5" style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        <button onClick={()=>setLocation(`/chat/${conv.user.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <img src={conv.user.avatarUrl??`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(conv.user.displayName)}`} alt={conv.user.displayName} className="w-12 h-12 rounded-full object-cover"/>
          <div className="flex-1 min-w-0"><p className="text-white/85 font-semibold text-sm truncate">{conv.user.displayName}</p><p className="text-white/40 text-sm truncate">{conv.lastMessage||"No messages yet"}</p></div>
        </button>
        <button onClick={()=>void unarchive(conv.id)} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5" title="Unarchive"><RotateCcw size={17} className="text-white/60"/></button>
      </div>)}
    </div>
    <BottomNav/>
  </div>;
}
