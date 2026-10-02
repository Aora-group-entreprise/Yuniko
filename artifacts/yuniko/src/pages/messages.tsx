import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, Edit, UserPlus, Archive, Phone, MessageSquarePlus, MoreHorizontal, Trash2, Ban, X, ChevronRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { t } from "@/lib/i18n";
import { apiJson } from "@/lib/api";
import ScreenPortal from "@/components/ScreenPortal";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { fetchSessionJson, getSessionCache, invalidateSessionCache, setSessionUser } from "@/lib/session-cache";
import { useAuth } from "@/lib/auth-context";

type Conversation = {
  id: number;
  user: { id:number; username:string; displayName:string; avatarUrl:string|null; verified:boolean };
  lastMessage: string;
  lastMessageTime: string|null;
  unread: number;
};

const GRADIENT="linear-gradient(135deg,#FF1493 0%,#008CFF 100%)";
const MESSAGE_LONG_PRESS_MS=800;

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
  const {user:authUser}=useAuth();
  setSessionUser(Number(authUser?.id));
  const [query,setQuery]=useState("");
  const [showNewMsg,setShowNewMsg]=useState(false);
  const cachedConversations = getSessionCache<{ conversations?: Conversation[] }>("/messages/conversations");
  const [conversations,setConversations]=useState<Conversation[]>(() => cachedConversations?.conversations ?? []);
  const [selected,setSelected]=useState<Conversation|null>(null);
  const [loading,setLoading]=useState(!cachedConversations);
  const [error,setError]=useState<string|null>(null);
  const [incomingCall,setIncomingCall]=useState<{id:string;callType:"voice"|"video";callerId:number;user:{id:number;displayName:string;avatarUrl:string|null}}|null>(null);
  const gestureRef=useRef<{id:number;x:number;y:number;startedAt:number;longPressTimer:number|null;longPressed:boolean;swiping:boolean;offset:number}|null>(null);
  const rowRefs=useRef<Record<number,HTMLButtonElement|null>>({});
  const archiveRefs=useRef<Record<number,HTMLDivElement|null>>({});
  const suppressClickRef=useRef(false); const longPressOpenedRef=useRef(false); const panelTouchLockRef=useRef(false);

  const load=()=>{
    setLoading(true);setError(null);
    void fetchSessionJson<{conversations:Conversation[]}>("/messages/conversations")
      .then(data=>setConversations(data.conversations??[]))
      .catch(err=>setError(err instanceof Error?err.message:"Unable to load messages"))
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);
  useEffect(()=>{if(!authUser?.id)return;const scheme=window.location.protocol==="https:"?"wss":"ws";const ws=new WebSocket(scheme+"://"+window.location.host+"/api/calls/ws?scope=inbox");ws.onmessage=event=>{try{const data=JSON.parse(String(event.data));if(data?.type==="incoming-call")setIncomingCall({id:String(data.roomId),callType:data.callType,callerId:Number(data.callerId),user:data.user});}catch{}};return()=>ws.close();},[authUser?.id]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return conversations;
    return conversations.filter(c=>c.user.displayName.toLowerCase().includes(q)||c.user.username.toLowerCase().includes(q)||c.lastMessage.toLowerCase().includes(q));
  },[conversations,query]);

  const totalUnread=conversations.reduce((sum,c)=>sum+c.unread,0);

  const archive=async(conv:Conversation)=>{
    setConversations(current=>current.filter(item=>item.id!==conv.id));
    try{await apiJson("/messages/conversations/"+conv.id+"/archive",{method:"POST"});invalidateSessionCache("/messages/conversations");}
    catch{invalidateSessionCache("/messages/conversations");load();}
  };

  const deleteConversation=async()=>{
    if(!selected)return;
    const id=selected.id;
    setSelected(null);
    setConversations(current=>current.filter(item=>item.id!==id));
    try{await apiJson("/messages/conversations/"+id,{method:"DELETE"});invalidateSessionCache("/messages/conversations");}
    catch{load();}
  };

  const blockUser=async()=>{
    if(!selected)return;
    const userId=selected.user.id;
    setSelected(null);
    setConversations(current=>current.filter(item=>item.user.id!==userId));
    try{
      await apiJson("/blocked-users/"+userId,{method:"POST"});
      invalidateSessionCache("/messages/conversations");
    }catch{
      invalidateSessionCache("/messages/conversations");
      load();
    }
  };

  return <div className="w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] min-h-0 flex flex-col overflow-hidden" style={{background:"#050509"}}>
    <header className="relative z-40 shrink-0 px-4 pt-6 pb-4 flex items-center justify-between" style={{background:"rgba(13,11,20,0.96)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)"}} data-testid="messages-header">
      <div className="flex items-center gap-2"><h1 className="text-[36px] font-extrabold tracking-[-0.045em] leading-none" style={{background:GRADIENT,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{t("messages")}</h1>{totalUnread>0&&<span className="text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center" style={{background:GRADIENT}}>{totalUnread}</span>}</div>
      <div className="flex items-center gap-3">
        <button onClick={()=>setLocation("/message-requests")} data-testid="btn-message-requests"><UserPlus size={20} className="text-white/70" strokeWidth={1.8}/></button>
        <button onClick={()=>setLocation("/archived-chats")} data-testid="btn-archived"><Archive size={20} className="text-white/70" strokeWidth={1.8}/></button>
        <button onClick={()=>setLocation("/call-history")} data-testid="btn-call-history"><Phone size={20} className="text-white/70" strokeWidth={1.8}/></button>
        <button onClick={()=>setShowNewMsg(true)} className="w-11 h-11 rounded-full flex items-center justify-center" style={{background:GRADIENT,boxShadow:"0 0 20px rgba(255,20,147,.28)"}} data-testid="btn-new-message"><Edit size={14} className="text-white"/></button>
      </div>
    </header>
    <div className="flex-1 min-h-0 overflow-y-auto pb-24">
      <div className="px-4 pt-3 pb-5"><div className="flex items-center gap-2.5 rounded-full p-[2px]" style={{background:GRADIENT,boxShadow:"0 0 20px rgba(255,20,147,.13)"}}><div className="flex w-full items-center gap-2.5 px-4 py-3 rounded-full" style={{background:"#0b0a10"}}>
        <Search size={16} className="text-white/40 flex-shrink-0"/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("searchUsers")} className="flex-1 bg-transparent text-white/80 text-sm outline-none placeholder:text-white/30" data-testid="input-search-messages"/>
      </div></div></div>
      <div data-testid="conversations-list">
        {loading?<LoadingSkeleton variant="list" />:error?<div className="flex flex-col items-center py-20 gap-3"><p className="text-red-300/70 text-sm text-center px-6">{error}</p><button onClick={load} className="text-white text-sm px-4 py-2 rounded-xl" style={{background:GRADIENT}}>Retry</button></div>:filtered.length===0?<div className="flex flex-col items-center justify-center py-20 gap-4"><div className="w-16 h-16 rounded-full flex items-center justify-center" style={{background:"rgba(255,0,110,0.1)",border:"1px solid rgba(255,0,110,0.2)"}}><MessageSquarePlus size={28} style={{color:"#FF3D9A"}}/></div><p className="text-white/40 text-sm">{query?t("noMessages"):"Follow each other to become friends and start chatting."}</p></div>:filtered.map(conv=>{
          const onTouchStart=(e:React.TouchEvent)=>{
            const touch=e.touches[0]; if(!touch)return;
            const row=rowRefs.current[conv.id];
            const archiveIcon=archiveRefs.current[conv.id];
            if(row){row.style.transition="none";row.style.transform="translate3d(0,0,0)";}
            if(archiveIcon){archiveIcon.style.transition="none";archiveIcon.style.opacity="0";archiveIcon.style.transform="translate3d(0,0,0) scale(.78) rotate(-8deg)";}
            const state={id:conv.id,x:touch.clientX,y:touch.clientY,startedAt:Date.now(),longPressTimer:null as number|null,longPressed:false,swiping:false,offset:0};
            suppressClickRef.current=true;
            longPressOpenedRef.current=false;
            state.longPressTimer=window.setTimeout(()=>{
              state.longPressed=true;
              if(navigator.vibrate)navigator.vibrate(25);
              suppressClickRef.current=true;
              longPressOpenedRef.current=true;
              panelTouchLockRef.current=true;
              setSelected(conv);
            },MESSAGE_LONG_PRESS_MS);
            gestureRef.current=state;
          };
          const onTouchMove=(e:React.TouchEvent)=>{
            const state=gestureRef.current, touch=e.touches[0]; if(!state||state.id!==conv.id||!touch)return;
            const dx=touch.clientX-state.x, dy=touch.clientY-state.y;
            if(!state.swiping && Math.abs(dy)>10 && Math.abs(dy)>=Math.abs(dx)){
              if(state.longPressTimer!==null){window.clearTimeout(state.longPressTimer);state.longPressTimer=null;}
              return;
            }
            if(!state.swiping && Math.abs(dx)>10 && Math.abs(dx)>Math.abs(dy)){
              state.swiping=true;
              if(state.longPressTimer!==null){window.clearTimeout(state.longPressTimer);state.longPressTimer=null;}
              suppressClickRef.current=true;
            }
            if(!state.swiping)return;
            const raw=Math.max(0,dx);
            const offset=raw<=140?raw:140+(raw-140)*0.2;
            state.offset=Math.min(offset,190);
            const row=rowRefs.current[conv.id];
            const archiveIcon=archiveRefs.current[conv.id];
            if(row)row.style.transform="translate3d("+state.offset+"px,0,0)";
            if(archiveIcon){
              const progress=Math.min(state.offset/110,1);
              const opacity=0.08+0.92*progress;
              const scale=0.78+0.22*progress;
              const rotation=-8+8*progress;
              const parallax=Math.min(state.offset*0.12,13);
              archiveIcon.style.opacity=String(opacity);
              archiveIcon.style.transform="translate3d("+parallax+"px,0,0) scale("+scale+") rotate("+rotation+"deg)";
            }
            e.preventDefault();
          };
          const onTouchEnd=(e:React.TouchEvent)=>{
            const state=gestureRef.current; gestureRef.current=null;
            if(!state||state.id!==conv.id)return;
            if(state.longPressTimer!==null){window.clearTimeout(state.longPressTimer);state.longPressTimer=null;}
            const row=rowRefs.current[conv.id];
            const archiveIcon=archiveRefs.current[conv.id];
            if(state.longPressed||longPressOpenedRef.current){
              // The action panel owns its own lifecycle. Releasing the finger must not close it.
              panelTouchLockRef.current=false;
              if(row){row.style.transition="transform 180ms ease-out";row.style.transform="translate3d(0,0,0)";}
              if(archiveIcon){archiveIcon.style.transition="opacity 150ms ease-out, transform 180ms cubic-bezier(.2,.8,.2,1)";archiveIcon.style.opacity="0";archiveIcon.style.transform="translate3d(0,0,0) scale(.78) rotate(-8deg)";}
              suppressClickRef.current=true;
              return;
            }
            if(state.swiping){
              const shouldArchive=state.offset>=110;
              if(row){
                row.style.transition=shouldArchive?"transform 220ms cubic-bezier(.2,.8,.2,1)":"transform 260ms cubic-bezier(.16,1,.3,1)";
                row.style.transform=shouldArchive?"translate3d(100%,0,0)":"translate3d(0,0,0)";
              }
              if(archiveIcon){
                archiveIcon.style.transition=shouldArchive?"opacity 140ms ease-out, transform 220ms cubic-bezier(.2,.8,.2,1)":"opacity 180ms ease-out, transform 260ms cubic-bezier(.16,1,.3,1)";
                archiveIcon.style.opacity=shouldArchive?"1":"0";
                archiveIcon.style.transform=shouldArchive?"translate3d(13px,0,0) scale(1.08) rotate(0deg)":"translate3d(0,0,0) scale(.78) rotate(-8deg)";
              }
              if(shouldArchive){window.setTimeout(()=>{void archive(conv);},220);}
              return;
            }
            suppressClickRef.current=false;
            setLocation(`/chat/${conv.user.id}`);
          };
          return <div key={conv.id} className="relative w-full overflow-hidden">
            <div ref={el=>{archiveRefs.current[conv.id]=el;}} className="absolute inset-y-0 left-0 w-24 flex items-center justify-center pointer-events-none" style={{opacity:0,transform:"translate3d(0,0,0) scale(.78) rotate(-8deg)"}}><Archive size={20} className="text-green-300"/></div>
            <button
              ref={el=>{rowRefs.current[conv.id]=el;}}
              onClick={e=>{if(suppressClickRef.current||longPressOpenedRef.current){e.preventDefault();e.stopPropagation();suppressClickRef.current=false;return;}setLocation(`/chat/${conv.user.id}`);}}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{touchAction:"pan-y",willChange:"transform"}}
              className="relative z-10 w-full flex items-center gap-3 px-4 py-4 text-left bg-transparent active:bg-white/5"
              data-testid={`conversation-${conv.id}`}
            >
              <div className="relative flex-shrink-0 p-[3px] rounded-full" style={{background:GRADIENT,boxShadow:"0 0 12px rgba(255,20,147,.16)"}}><img src={conv.user.avatarUrl??`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(conv.user.displayName)}`} alt={conv.user.displayName} className="w-[58px] h-[58px] rounded-full object-cover border-[3px] border-[#050509]"/></div>
              <div className="flex-1 min-w-0"><div className="flex items-center justify-between"><span className={`font-bold text-[19px] ${conv.unread>0?"text-white":"text-white/82"}`}>{conv.user.displayName}</span><span className="text-xs flex-shrink-0 ml-2" style={{color:conv.unread>0?"#FF3D9A":"rgba(255,255,255,0.35)"}}>{formatTime(conv.lastMessageTime)}</span></div>
                <div className="flex items-center justify-between mt-0.5"><p className={`text-[15px] truncate ${conv.unread>0?"text-white/82 font-medium":"text-white/48"}`}>{conv.lastMessage||"No messages yet"}</p>{conv.unread>0&&<span className="ml-2 min-w-[20px] h-5 px-1 rounded-full text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0" style={{background:GRADIENT}}>{conv.unread}</span>}</div>
              </div>
            </button>
          </div>;
        })}
      </div>
    </div>
    {incomingCall&&<ScreenPortal><div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"><div className="w-full max-w-[430px] rounded-t-3xl p-5" style={{background:"rgba(18,15,30,0.99)"}}>
      <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4"/>
      <div className="flex items-center gap-3 mb-5"><img src={incomingCall.user.avatarUrl??"https://api.dicebear.com/9.x/initials/svg?seed="+encodeURIComponent(incomingCall.user.displayName)} alt="" className="w-12 h-12 rounded-full object-cover"/><div><p className="text-white font-semibold">{incomingCall.user.displayName}</p><p className="text-white/45 text-sm">{incomingCall.callType==="video"?"Appel vidéo entrant":"Appel audio entrant"}</p></div></div>
      <div className="flex gap-3"><button onClick={async()=>{try{await apiJson("/calls/"+incomingCall.id+"/reject",{method:"POST",body:JSON.stringify({callerId:incomingCall.callerId})});}catch{}setIncomingCall(null);}} className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-300">Refuser</button><button onClick={()=>{const call=incomingCall;setIncomingCall(null);setLocation("/"+(call.callType==="video"?"video-call/":"voice-call/")+call.callerId+"?callId="+encodeURIComponent(call.id)+"&incoming=1");}} className="flex-1 py-3 rounded-xl text-white" style={{background:GRADIENT}}>Répondre</button></div>
    </div></div></ScreenPortal>}

    <BottomNav/>
    {showNewMsg&&<ScreenPortal><><div className="fixed inset-0 z-50 bg-black/60" onClick={()=>setShowNewMsg(false)}/><div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-2xl overflow-hidden" style={{background:"rgba(18,15,30,0.98)",border:"1px solid rgba(255,0,110,0.15)"}}>
      <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1"/><p className="text-white font-semibold text-sm px-5 py-3">Friends</p>
      {conversations.map(conv=><button key={conv.id} onClick={()=>{setShowNewMsg(false);setLocation(`/chat/${conv.user.id}`);}} className="w-full flex items-center gap-3 px-5 py-3.5" style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>
        <img src={conv.user.avatarUrl??`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(conv.user.displayName)}`} alt={conv.user.displayName} className="w-10 h-10 rounded-full object-cover"/>
        <div className="text-left"><p className="text-white font-medium text-sm">{conv.user.displayName}</p><p className="text-white/40 text-xs">@{conv.user.username}</p></div>
      </button>)}
      <div className="h-6"/>
    </div></></ScreenPortal>}

    {selected&&<ScreenPortal><><div className="fixed inset-0 z-50 bg-black/60" style={{pointerEvents:panelTouchLockRef.current?"none":"auto"}} onClick={()=>{if(panelTouchLockRef.current)return;setSelected(null)}}/>
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-3xl overflow-hidden" style={{background:"rgba(18,15,30,0.99)",border:"1px solid rgba(255,255,255,0.08)",pointerEvents:panelTouchLockRef.current?"none":"auto"}} data-testid="conversation-actions-panel">
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-2"/>
        <div className="px-5 py-4 flex items-center gap-3" style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <img src={selected.user.avatarUrl??`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(selected.user.displayName)}`} alt={selected.user.displayName} className="w-11 h-11 rounded-full object-cover"/>
          <div className="flex-1 min-w-0"><p className="text-white font-semibold text-sm truncate">{selected.user.displayName}</p><p className="text-white/40 text-xs">@{selected.user.username}</p></div>
          <button onClick={()=>setSelected(null)} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5"><X size={18} className="text-white/60"/></button>
        </div>
        <button onClick={()=>{setSelected(null);setLocation(`/chat/${selected.user.id}`);}} className="w-full flex items-center gap-3 px-5 py-4 text-left" style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}><MoreHorizontal size={20} className="text-white/70"/><span className="text-white/85 text-sm flex-1">Open conversation</span><ChevronRight size={17} className="text-white/30"/></button>
        <button onClick={()=>{setSelected(null);void archive(selected);}} className="w-full flex items-center gap-3 px-5 py-4 text-left" style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}><Archive size={20} className="text-white/70"/><span className="text-white/85 text-sm flex-1">{t("archiveChat")}</span></button>
        <button onClick={()=>void deleteConversation()} className="w-full flex items-center gap-3 px-5 py-4 text-left" style={{borderBottom:"1px solid rgba(255,255,255,0.06)"}}><Trash2 size={20} className="text-red-300"/><span className="text-red-300 text-sm flex-1">{t("deleteChat")}</span></button>
        <button onClick={()=>void blockUser()} className="w-full flex items-center gap-3 px-5 py-4 text-left"><Ban size={20} className="text-red-300"/><span className="text-red-300 text-sm flex-1">{t("block")}</span></button>
        <div className="h-5"/>
      </div>
    </></ScreenPortal>}
  </div>;
}
