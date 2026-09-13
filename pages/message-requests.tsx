import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { apiJson } from "@/lib/api";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

type RequestItem = { id:number; senderId:number; message:string; createdAt:string; senderUsername:string; senderDisplayName:string; senderAvatarUrl:string|null };

export default function MessageRequests() {
  const [, setLocation] = useLocation();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiJson<{requests:RequestItem[]}>("/message-requests").then(d=>setRequests(d.requests??[])).catch(()=>setRequests([])).finally(()=>setLoading(false)); }, []);
  const updateRequest = async (id:number,status:"accepted"|"declined") => { const request=requests.find(r=>r.id===id); const result=await apiJson<{request:RequestItem}>(`/message-requests/${id}`,{method:"PATCH",body:JSON.stringify({status})}).catch(()=>null); if(!result)return; setRequests(prev=>prev.filter(r=>r.id!==id)); if(status==="accepted"&&request)setLocation(`/chat/${request.senderId}`); };
  return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
    <header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{background:"rgba(13,11,20,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)"}} data-testid="message-requests-header"><button onClick={()=>setLocation("/messages")} data-testid="btn-back-requests"><ArrowLeft size={22} className="text-white/80"/></button><h1 className="text-base font-semibold text-white">{t("messageRequests")}</h1></header>
    <div className="px-4 py-3"><p className="text-white/40 text-sm mb-4">People you don't follow will appear here. They won't know you've seen their requests until you accept.</p>
      {loading?<p className="text-white/40 text-sm py-16 text-center">Loading...</p>:requests.length===0?<div className="flex flex-col items-center justify-center py-16 gap-3"><MessageCircle size={40} className="text-white/20"/><p className="text-white/40 text-sm">No message requests</p></div>:requests.map(req=><div key={req.id} className="p-4 rounded-2xl mb-3" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}} data-testid={`message-request-${req.id}`}>
        <div className="flex items-center gap-3 mb-3"><button onClick={()=>setLocation(`/user/${req.senderId}`)}><img src={req.senderAvatarUrl||`https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(req.senderDisplayName)}`} alt={req.senderDisplayName} className="w-10 h-10 rounded-full object-cover"/></button><div className="flex-1"><p className="text-white font-semibold text-sm">{req.senderDisplayName}</p><p className="text-white/40 text-xs">@{req.senderUsername} · {new Date(req.createdAt).toLocaleString()}</p></div></div>
        <p className="text-white/70 text-sm mb-3 line-clamp-2">{req.message}</p><div className="flex gap-2"><button onClick={()=>updateRequest(req.id,"accepted")} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white" style={{background:"linear-gradient(135deg,#FF006E 0%,#8B00FF 100%)"}} data-testid={`btn-accept-request-${req.id}`}>{t("accept")}</button><button onClick={()=>updateRequest(req.id,"declined")} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white/60" style={{background:"rgba(255,255,255,0.08)"}} data-testid={`btn-decline-request-${req.id}`}>{t("decline")}</button></div>
      </div>)}</div><BottomNav/></div>;
}
