import { useEffect,useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft,PhoneIncoming,PhoneOutgoing,PhoneMissed,Phone,Video } from "lucide-react";
import { apiJson } from "@/lib/api";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

type CallItem={id:string;user:{id:number;username:string;displayName:string;avatarUrl:string|null;verified:boolean};type:"incoming"|"outgoing";callType:"voice"|"video";status:string;missed:boolean;duration:number;timestamp:string|null};

function formatTime(value:string|null){if(!value)return "";const date=new Date(value);if(Number.isNaN(date.getTime()))return "";const diff=Date.now()-date.getTime();if(diff<60000)return "now";if(diff<3600000)return Math.floor(diff/60000)+"m";if(diff<86400000)return Math.floor(diff/3600000)+"h";return date.toLocaleDateString([],{day:"2-digit",month:"2-digit"});}
function formatDuration(seconds:number){if(!seconds)return "—";const m=Math.floor(seconds/60),s=seconds%60;return m+":"+String(s).padStart(2,"0");}

export default function CallHistory(){
 const [,setLocation]=useLocation();const [calls,setCalls]=useState<CallItem[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
 useEffect(()=>{void apiJson<{calls:CallItem[]}>("/calls/history").then(data=>setCalls(data.calls??[])).catch(err=>setError(err instanceof Error?err.message:"Unable to load call history")).finally(()=>setLoading(false));},[]);
 return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
  <header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{background:"rgba(13,11,20,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)"}} data-testid="call-history-header">
   <button onClick={()=>setLocation("/messages")} data-testid="btn-back-call-history"><ArrowLeft size={22} className="text-white/80"/></button><h1 className="text-base font-semibold text-white">{t("callHistory")}</h1>
  </header>
  <div data-testid="call-log">
   {error&&<div className="p-4 text-sm text-red-300">{error}</div>}
   {loading?<div className="p-8 text-center text-white/40">Loading...</div>:calls.length===0?<div className="p-8 text-center text-white/40">No call history</div>:calls.map(call=><button key={call.id} onClick={()=>setLocation("/"+(call.callType==="video"?"video-call":"voice-call"))} className="w-full flex items-center gap-3 px-4 py-3.5 text-left" style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}} data-testid={"call-"+call.id}>
    <img src={call.user.avatarUrl||("https://api.dicebear.com/9.x/initials/svg?seed="+encodeURIComponent(call.user.displayName))} alt={call.user.displayName} className="w-11 h-11 rounded-full object-cover"/>
    <div className="flex-1 min-w-0"><p className="text-white font-semibold text-sm">{call.user.displayName}</p><div className="flex items-center gap-1.5 mt-0.5">{call.missed?<PhoneMissed size={13} className="text-red-400"/>:call.type==="incoming"?<PhoneIncoming size={13} className="text-green-400"/>:<PhoneOutgoing size={13} className="text-blue-400"/>}<span className={`text-xs ${call.missed?"text-red-400":"text-white/50"}`}>{call.missed?"Missed":call.type} · {formatDuration(call.duration)}</span><span className="text-white/30 text-xs">· {formatTime(call.timestamp)}</span></div></div>
    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:"rgba(255,0,110,0.12)",border:"1px solid rgba(255,0,110,0.25)"}}>{call.callType==="video"?<Video size={16} style={{color:"#FF3D9A"}}/>:<Phone size={16} style={{color:"#FF3D9A"}}/>}</div>
   </button>)}
  </div><BottomNav/>
 </div>;
}
