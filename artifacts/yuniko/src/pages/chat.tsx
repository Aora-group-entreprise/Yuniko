import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Phone, Video, MoreHorizontal, Image, Smile, Mic, Send, Camera, BadgeCheck } from "lucide-react";
import { t } from "@/lib/i18n";
import ScreenPortal from "@/components/ScreenPortal";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Message={id:number;senderId:number;text?:string;imageUrl?:string;timestamp:string|null;read:boolean;reactions:string[];type:"text"|"image"};

type ChatUser={id:number;username:string;displayName:string;avatarUrl:string|null;verified:boolean};

const GRADIENT="linear-gradient(135deg,#FF006E 0%,#8B00FF 100%)";

function formatTime(value:string|null){
  if(!value) return "";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":date.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
}

export default function Chat(){
  const [,setLocation]=useLocation();
  const params=useParams<{userId:string}>();
  const {user:authUser}=useAuth();
  const userId=Number(params?.userId);
  const [user,setUser]=useState<ChatUser|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [inputText,setInputText]=useState("");
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const bottomRef=useRef<HTMLDivElement>(null);

  const load=()=>{
    if(!Number.isInteger(userId)||userId<=0) return;
    setLoading(true);setError(null);
    void apiJson<{user:ChatUser;messages:Message[]}>(`/messages/conversations/${userId}`)
      .then(data=>{setUser(data.user);setMessages(data.messages??[]);})
      .catch(err=>setError(err instanceof Error?err.message:"Unable to load chat"))
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{load();},[userId]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  const sendMessage=async()=>{
    const text=inputText.trim();
    if(!text||sending||!user) return;
    setSending(true);
    try{
      const data=await apiJson<{message:Message}>(`/messages/conversations/${user.id}`,{method:"POST",body:JSON.stringify({text})});
      setMessages(prev=>[...prev,data.message]);
      setInputText("");
    }catch(err){setError(err instanceof Error?err.message:"Unable to send message");}
    finally{setSending(false);}
  };

  if(loading) return <div className="w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] bg-background flex items-center justify-center text-white/40 text-sm">Loading...</div>;
  if(error&&!user) return <div className="w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] bg-background flex flex-col items-center justify-center gap-4 px-6"><p className="text-red-300/70 text-sm text-center">{error}</p><button onClick={()=>setLocation("/messages")} className="px-4 py-2 rounded-xl text-white text-sm" style={{background:GRADIENT}}>Back</button></div>;
  if(!user) return null;

  return <div className="w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] min-h-0 bg-background flex flex-col overflow-hidden">
    <header className="relative z-40 shrink-0 px-4 py-3 flex items-center gap-3" style={{background:"rgba(13,11,20,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)"}} data-testid="chat-header">
      <button onClick={()=>setLocation("/messages")} data-testid="btn-back-chat"><ArrowLeft size={22} className="text-white/80"/></button>
      <button onClick={()=>setLocation(`/user/${user.id}`)} className="flex items-center gap-2.5 flex-1" data-testid="btn-chat-user-profile">
        <img src={user.avatarUrl??`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.displayName)}`} alt={user.displayName} className="w-9 h-9 rounded-full object-cover"/>
        <div><div className="flex items-center gap-1"><span className="text-white font-semibold text-sm">{user.displayName}</span>{user.verified&&<BadgeCheck size={13} className="text-blue-400 fill-blue-400"/>}</div><span className="text-white/50 text-xs">@{user.username}</span></div>
      </button>
      <div className="flex min-w-0 items-center gap-[clamp(6px,2vw,8px)]">
        <button onClick={()=>setLocation("/voice-call")} data-testid="btn-voice-call"><Phone size={20} className="text-white/70" strokeWidth={1.8}/></button>
        <button onClick={()=>setLocation("/video-call")} data-testid="btn-video-call"><Video size={20} className="text-white/70" strokeWidth={1.8}/></button>
        <button data-testid="btn-chat-options"><MoreHorizontal size={20} className="text-white/70"/></button>
      </div>
    </header>
    <div className="flex-1 overflow-y-auto px-3 py-4 pb-2" style={{paddingBottom:80}} data-testid="messages-container">
      {messages.length===0?<div className="h-full flex items-center justify-center text-white/30 text-sm">Start the conversation.</div>:messages.map(msg=>{
        const isMe=Number(msg.senderId)===Number(authUser?.id);
        return <div key={msg.id} className={`flex mb-2 ${isMe?"justify-end":"justify-start"}`} data-testid={`message-${msg.id}`}>
          {!isMe&&<img src={user.avatarUrl??`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.displayName)}`} alt="" className="w-7 h-7 rounded-full object-cover mr-2 mt-auto flex-shrink-0"/>}
          <div className={`max-w-[75%] ${isMe?"items-end":"items-start"} flex flex-col`}>
            {msg.type==="image"&&msg.imageUrl?<img src={msg.imageUrl} alt="Photo" className="max-w-[200px] rounded-2xl"/>:<div className={`px-3.5 py-2.5 rounded-2xl text-sm ${isMe?"rounded-br-sm text-white":"rounded-bl-sm text-white/90"}`} style={{background:isMe?GRADIENT:"rgba(255,255,255,0.08)"}}>{msg.text}</div>}
            <span className="text-white/30 text-[10px] mt-1 px-1">{formatTime(msg.timestamp)}</span>
          </div>
        </div>;
      })}<div ref={bottomRef}/>
    </div>
    <ScreenPortal><div className="fixed inset-x-0 mx-auto w-full max-w-[430px] min-w-0 px-[clamp(8px,3vw,12px)] py-3" style={{background:"rgba(13,11,20,0.95)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.07)",left:0,right:0,marginLeft:"auto",marginRight:"auto",transform:"none",boxSizing:"border-box",bottom:"var(--yuniko-keyboard-offset, 0px)",paddingBottom:"max(12px, env(safe-area-inset-bottom, 0px))"}} data-testid="chat-input-bar">
      <div className="flex items-center gap-2">
        <button className="flex-shrink-0" data-testid="btn-attach-media"><Image size={22} style={{color:"#FF3D9A"}} strokeWidth={1.8}/></button>
        <button className="flex-shrink-0" data-testid="btn-camera-msg"><Camera size={22} style={{color:"#FF3D9A"}} strokeWidth={1.8}/></button>
        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-full" style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)"}}>
          <input value={inputText} onChange={e=>setInputText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void sendMessage()} placeholder={t("typeMessage")} className="flex-1 bg-transparent text-white/85 text-sm outline-none placeholder:text-white/30" data-testid="input-message"/>
          <button className="flex-shrink-0" data-testid="btn-emoji"><Smile size={18} className="text-white/40"/></button>
        </div>
        {inputText.trim()?<button onClick={()=>void sendMessage()} disabled={sending} className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50" style={{background:GRADIENT,boxShadow:"0 2px 12px rgba(255,0,110,0.4)"}} data-testid="btn-send"><Send size={16} className="text-white ml-0.5"/></button>:<button className="flex-shrink-0" data-testid="btn-voice-msg"><Mic size={22} style={{color:"#FF3D9A"}} strokeWidth={1.8}/></button>}
      </div>
    </div></ScreenPortal>
  </div>;
}
