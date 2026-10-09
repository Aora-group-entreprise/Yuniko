import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Phone, Video, MoreHorizontal, Image as ImageIcon, Smile, Mic, Send, Camera, BadgeCheck } from "lucide-react";
import { t } from "@/lib/i18n";
import ScreenPortal from "@/components/ScreenPortal";
import {deviceInfo,encryptForDevices,encryptForPublicKey,decryptFromPublicKey} from "@/lib/e2e";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { fetchSessionJson, getSessionCache, invalidateSessionCache, setSessionCache, setSessionUser } from "@/lib/session-cache";

type Reaction={reaction:string;count:number;reacted:boolean};
type Message={
  id:number;senderId:number;text?:string;encryptionPublicKey?:string|null;imageUrl?:string;audioUrl?:string;videoUrl?:string;fileUrl?:string;
  fileName?:string|null;fileSize?:number|null;mediaMimeType?:string|null;durationMs?:number|null;
  timestamp:string|null;read:boolean;delivered?:boolean;edited?:boolean;deleted?:boolean;
  replyToMessageId?:number|null;forwardedFromMessageId?:number|null;reactions:Reaction[];
  type:"text"|"image"|"audio"|"video"|"file"|"sticker";
};
type ChatUser={id:number;username:string;displayName:string;avatarUrl:string|null;verified:boolean;encryptionPublicKey?:string|null;encryptionDevices?:{deviceId:string;publicKey:string}[]};
const GRADIENT="linear-gradient(135deg,#FF1493 0%,#008CFF 100%)";

function formatTime(value:string|null){
  if(!value)return "";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":date.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
}
function avatar(user:ChatUser){
  return user.avatarUrl??("https://api.dicebear.com/9.x/initials/svg?seed="+encodeURIComponent(user.displayName));
}

export default function Chat(){
  const [,setLocation]=useLocation();
  const params=useParams<{userId:string}>();
  const {user:authUser}=useAuth();
  setSessionUser(Number(authUser?.id));
  const userId=Number(params?.userId);
  const cacheKey=Number.isInteger(userId)&&userId>0?"/messages/conversations/"+userId:"";
  const cached=cacheKey?getSessionCache<{user:ChatUser;messages:Message[];otherTyping?:boolean;otherActiveAt?:string|null;otherOnline?:boolean}>(cacheKey):undefined;
  const [user,setUser]=useState<ChatUser|null>(()=>cached?.user??null);
  const [messages,setMessages]=useState<Message[]>(()=>cached?.messages??[]);
  const [inputText,setInputText]=useState("");
  useEffect(()=>{void deviceInfo().then(d=>apiJson("/messages/devices",{method:"POST",body:JSON.stringify(d)})).catch(()=>{});},[]);
  const [loading,setLoading]=useState(!cached);
  const [sending,setSending]=useState(false);
  const [mediaSending,setMediaSending]=useState(false);
  const [recording,setRecording]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [otherTyping,setOtherTyping]=useState(Boolean(cached?.otherTyping));
  const [otherActiveAt,setOtherActiveAt]=useState<string|null>(cached?.otherActiveAt??null);
  const [otherOnline,setOtherOnline]=useState(Boolean(cached?.otherOnline));
  const [selectedMessage,setSelectedMessage]=useState<Message|null>(null);
  const [incomingCall,setIncomingCall]=useState<{roomId:string;callType:"voice"|"video";callerId:number;user:{id:number;displayName:string;avatarUrl:string|null}}|null>(null);
  useEffect(()=>{
    const scheme=window.location.protocol==="https:"?"wss":"ws";
    const ws=new WebSocket(scheme+"://"+window.location.host+"/api/calls/ws?scope=inbox");
    ws.onmessage=event=>{try{const data=JSON.parse(String(event.data));if(data?.type==="incoming-call")setIncomingCall({roomId:String(data.roomId),callType:data.callType,callerId:Number(data.callerId),user:data.user});}catch{}};
    return()=>ws.close();
  },[]);

  const [showChatMenu,setShowChatMenu]=useState(false);
  const [readReceiptsEnabled,setReadReceiptsEnabled]=useState(true);
  const [nickname,setNickname]=useState("");
  const [replyingTo,setReplyingTo]=useState<Message|null>(null);
  const [editingMessage,setEditingMessage]=useState<Message|null>(null);
  const [selectedMediaFile,setSelectedMediaFile]=useState<File|null>(null);
  const [selectedMediaPreview,setSelectedMediaPreview]=useState<string|null>(null);
  const bottomRef=useRef<HTMLDivElement>(null);
  const mediaInputRef=useRef<HTMLInputElement>(null);
  const cameraInputRef=useRef<HTMLInputElement>(null);
  const mediaRecorderRef=useRef<MediaRecorder|null>(null);
  const recordingChunksRef=useRef<Blob[]>([]);
  const recordingStartedAtRef=useRef(0);
  const typingTimerRef=useRef<number|null>(null);
  const lastMessageIdRef=useRef(Math.max(0,...(cached?.messages??[]).map(m=>m.id)));

  const load=async()=>{
    if(!Number.isInteger(userId)||userId<=0)return;
    setLoading(true);setError(null);
    try{
      const data=await fetchSessionJson<{user:ChatUser;messages:Message[];otherTyping?:boolean;otherActiveAt?:string|null;settings?:{readReceiptsEnabled?:boolean;nickname?:string}}>("/messages/conversations/"+userId);
      setUser(data.user);
      setMessages(await Promise.all((data.messages??[]).map(async m=>({...m,text:m.text&&(m.text.startsWith("enc2.")||m.encryptionPublicKey)?await decryptFromPublicKey(m.encryptionPublicKey,m.text).catch(()=>m.text):m.text}))));
      setReadReceiptsEnabled(data.settings?.readReceiptsEnabled!==false);
      setNickname(data.settings?.nickname??"");
      setOtherTyping(Boolean(data.otherTyping));setOtherActiveAt(data.otherActiveAt??null);
      lastMessageIdRef.current=Math.max(0,...(data.messages??[]).map(m=>m.id));
    }catch(err){setError(err instanceof Error?err.message:"Unable to load chat");}
    finally{setLoading(false);}
  };

  useEffect(()=>{void load();},[userId]);

  useEffect(()=>{
    if(!Number.isInteger(userId)||userId<=0)return;
    let alive=true;
    void apiJson<{online:boolean}>("/realtime/presence?userId="+userId).then(data=>{if(alive)setOtherOnline(Boolean(data.online));}).catch(()=>{if(alive)setOtherOnline(false);});
    const onPresence=(event:Event)=>{
      const detail=(event as CustomEvent<Record<string,unknown>>).detail;
      if(Number(detail?.userId)!==userId)return;
      setOtherOnline(Boolean(detail?.online));
    };
    window.addEventListener("yuniko:presence",onPresence);
    return()=>{alive=false;window.removeEventListener("yuniko:presence",onPresence);};
  },[userId]);

  useEffect(()=>{
    if(!Number.isInteger(userId)||userId<=0)return;
    const onRealtime=(event:Event)=>{
      const detail=(event as CustomEvent<Record<string,unknown>>).detail;
      if(!detail)return;
      const eventUserId=Number(detail.userId??detail.fromUserId);
      if(detail.type==="chat:typing"&&eventUserId===userId){setOtherTyping(Boolean(detail.typing));return;}
      if(detail.type!=="message:new"||eventUserId!==userId)return;
      const raw=(detail.message??detail.realtimeMessage) as Message|undefined;
      if(!raw||!Number.isInteger(Number(raw.id)))return;
      void (async()=>{
        const fresh:Message={
          ...raw,
          text:raw.text&&(raw.text.startsWith("enc2.")||raw.encryptionPublicKey)
            ?await decryptFromPublicKey(raw.encryptionPublicKey,raw.text).catch(()=>raw.text)
            :raw.text,
          reactions:Array.isArray(raw.reactions)?raw.reactions:[],
        };
        lastMessageIdRef.current=Math.max(lastMessageIdRef.current,Number(fresh.id));
        setMessages(current=>{
          if(current.some(message=>message.id===fresh.id))return current;
          const next=[...current,fresh];
          if(user)setSessionCache(cacheKey,{user,messages:next,otherTyping:false,otherActiveAt,otherOnline});
          return next;
        });
      })();
    };
    window.addEventListener("yuniko:realtime",onRealtime);
    return()=>window.removeEventListener("yuniko:realtime",onRealtime);
  },[userId,user?.id,cacheKey,otherActiveAt,otherOnline]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  useEffect(()=>()=>{mediaRecorderRef.current?.stop();if(typingTimerRef.current!==null)window.clearTimeout(typingTimerRef.current);},[]);
  useEffect(()=>()=>{if(selectedMediaPreview)URL.revokeObjectURL(selectedMediaPreview);},[selectedMediaPreview]);

  const sendTyping=async(typing:boolean)=>{
    if(!user)return;
    try{await apiJson("/messages/conversations/"+user.id+"/typing",{method:"POST",body:JSON.stringify({typing})});}catch{}
  };
  const handleInput=(value:string)=>{
    setInputText(value);
    if(typingTimerRef.current!==null)window.clearTimeout(typingTimerRef.current);
    if(value.trim())void sendTyping(true);
    typingTimerRef.current=window.setTimeout(()=>void sendTyping(false),1800);
  };

  const sendMessage=async()=>{
    const text=inputText.trim();
    if(!text||sending||!user||editingMessage)return;
    setSending(true);setError(null);
    try{
      const device=await deviceInfo();
      const targets=(user.encryptionDevices??[]).concat([{deviceId:device.deviceId,publicKey:device.publicKey}]);
      const payload=targets.length>0?await encryptForDevices(targets,text):user.encryptionPublicKey?await encryptForPublicKey(user.encryptionPublicKey,text):text;
      const encryptionVersion=payload.startsWith("enc2.")?2:payload.startsWith("enc1.")?1:null;
      const data=await apiJson<{message:Message}>("/messages/conversations/"+user.id,{method:"POST",body:JSON.stringify({text:payload,replyToMessageId:replyingTo?.id??null,encryptionVersion,senderDeviceId:device.deviceId})});
      setMessages(current=>current.concat({...data.message,text}));
      lastMessageIdRef.current=Math.max(lastMessageIdRef.current,data.message.id);
      setInputText("");setReplyingTo(null);invalidateSessionCache(cacheKey);void sendTyping(false);
    }catch(err){setError(err instanceof Error?err.message:"Unable to send message");}
    finally{setSending(false);}
  };

  const editMessage=async()=>{
    const text=inputText.trim();
    if(!editingMessage||!text||sending)return;
    setSending(true);setError(null);
    try{
      await apiJson("/messages/"+editingMessage.id,{method:"PATCH",body:JSON.stringify({text})});
      setMessages(current=>current.map(m=>m.id===editingMessage.id?{...m,text,edited:true}:m));
      setEditingMessage(null);setInputText("");setSelectedMessage(null);invalidateSessionCache(cacheKey);
    }catch(err){setError(err instanceof Error?err.message:"Unable to edit message");}
    finally{setSending(false);}
  };

  const react=async(reaction:string)=>{
    if(!selectedMessage)return;
    try{
      await apiJson("/messages/"+selectedMessage.id+"/reaction",{method:"POST",body:JSON.stringify({reaction})});
      setMessages(current=>current.map(m=>{
        if(m.id!==selectedMessage.id)return m;
        const old=m.reactions.find(r=>r.reaction===reaction);
        if(!old)return {...m,reactions:m.reactions.concat({reaction,count:1,reacted:true})};
        return {...m,reactions:m.reactions.map(r=>r.reaction===reaction?{...r,count:r.reacted?Math.max(0,r.count-1):r.count+1,reacted:!r.reacted}:r).filter(r=>r.count>0)};
      }));
    }catch(err){setError(err instanceof Error?err.message:"Unable to react to message");}
    finally{setSelectedMessage(null);}
  };

  const deleteMessage=async(forEveryone:boolean)=>{
    if(!selectedMessage)return;
    try{
      await apiJson("/messages/"+selectedMessage.id+(forEveryone?"?forEveryone=true":""),{method:"DELETE"});
      if(forEveryone)setMessages(current=>current.map(m=>m.id===selectedMessage.id?{...m,text:"This message was deleted",imageUrl:undefined,audioUrl:undefined,deleted:true,edited:false}:m));
      else setMessages(current=>current.filter(m=>m.id!==selectedMessage.id));
      invalidateSessionCache(cacheKey);
    }catch(err){setError(err instanceof Error?err.message:"Unable to delete message");}
    finally{setSelectedMessage(null);}
  };

  const forwardMessage=async()=>{
    if(!selectedMessage||!user)return;
    try{
      const data=await apiJson<{message:Message}>("/messages/"+selectedMessage.id+"/forward",{method:"POST",body:JSON.stringify({targetUserId:user.id})});
      setMessages(current=>current.concat(data.message));lastMessageIdRef.current=Math.max(lastMessageIdRef.current,data.message.id);
    }catch(err){setError(err instanceof Error?err.message:"Unable to forward message");}
    finally{setSelectedMessage(null);}
  };

  const prepareImage=async(blob:Blob)=>{
    if(!blob.type.startsWith("image/"))return blob;
    try{
      const bitmap=await createImageBitmap(blob),maxSide=1600,scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext("2d");if(!context){bitmap.close();return blob;}
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Unable to prepare image")),"image/jpeg",0.82));
    }catch{return blob;}
  };

  const sendMedia=async(blob:Blob,kind:"image"|"audio"|"video"|"file",durationMs?:number,fileName?:string)=>{
    if(!user||mediaSending)return;
    setMediaSending(true);setError(null);
    try{
      const prepared=kind==="image"?await prepareImage(blob):blob;
      const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Unable to read media"));reader.readAsDataURL(prepared);});
      const data=await apiJson<{message:Message}>("/messages/conversations/"+user.id+"/media",{method:"POST",body:JSON.stringify({dataUrl,kind,durationMs,fileName:fileName??"attachment"})});
      setMessages(current=>current.concat(data.message));lastMessageIdRef.current=Math.max(lastMessageIdRef.current,data.message.id);invalidateSessionCache(cacheKey);
    }catch(err){setError(err instanceof Error?err.message:"Unable to send media");}
    finally{setMediaSending(false);}
  };

  const chooseMedia=(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value="";
    if(!file||!file.type.startsWith("image/"))return;
    if(selectedMediaPreview)URL.revokeObjectURL(selectedMediaPreview);
    setSelectedMediaFile(file);setSelectedMediaPreview(URL.createObjectURL(file));
  };
  const confirmMedia=async()=>{
    if(!selectedMediaFile)return;
    const file=selectedMediaFile;
    setSelectedMediaFile(null);setSelectedMediaPreview(current=>{if(current)URL.revokeObjectURL(current);return null;});
    const kind=file.type.startsWith("video/")?"video":file.type.startsWith("image/")?"image":"file";
    await sendMedia(file,kind,undefined,file.type==="image/gif"?"gif":file.name);
  };

  const reportMessage=async()=>{
    if(!selectedMessage)return;
    const reason=window.prompt("Report reason: spam, harassment, or other","spam")?.trim().toLowerCase();
    if(!reason)return;
    try{await apiJson("/messages/"+selectedMessage.id+"/report",{method:"POST",body:JSON.stringify({reason})});setError("Report sent");}
    catch(err){setError(err instanceof Error?err.message:"Unable to report message");}
    finally{setSelectedMessage(null);}
  };

  const blockUser=async()=>{
    if(!user)return;
    try{await apiJson("/blocked-users/"+user.id,{method:"POST"});setLocation("/messages");}
    catch(err){setError(err instanceof Error?err.message:"Unable to block user");}
    finally{setSelectedMessage(null);setShowChatMenu(false);}
  };

  const updateChatSettings=async(next:{readReceiptsEnabled?:boolean;nickname?:string})=>{
    if(!user)return;
    try{
      const data=await apiJson<{settings:{readReceiptsEnabled:boolean;nickname:string}}>("/messages/conversations/"+user.id+"/settings",{method:"POST",body:JSON.stringify(next)});
      setReadReceiptsEnabled(data.settings.readReceiptsEnabled);setNickname(data.settings.nickname);setError(null);
    }catch(err){setError(err instanceof Error?err.message:"Unable to update chat settings");}
  };

  const markConversationUnread=async()=>{
    if(!user)return;
    try{await apiJson("/messages/conversations/"+user.id+"/unread",{method:"POST"});invalidateSessionCache("/messages/conversations/"+user.id);setLocation("/messages");}
    catch(err){setError(err instanceof Error?err.message:"Unable to mark conversation unread");}
  };

  const setChatNickname=async()=>{
    const value=window.prompt("Pseudo pour cette conversation",nickname);
    if(value===null)return;
    await updateChatSettings({nickname:value});
  };

  const toggleRecording=async()=>{
    if(recording){mediaRecorderRef.current?.stop();return;}
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setError("Voice recording is not supported by this browser");return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const types=["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4"];
      const supported=types.find(type=>typeof MediaRecorder.isTypeSupported==="function"&&MediaRecorder.isTypeSupported(type));
      const recorder=supported?new MediaRecorder(stream,{mimeType:supported}):new MediaRecorder(stream);
      recordingChunksRef.current=[];recorder.ondataavailable=e=>{if(e.data.size)recordingChunksRef.current.push(e.data);};
      recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());const blob=new Blob(recordingChunksRef.current,{type:recorder.mimeType||"audio/webm"});mediaRecorderRef.current=null;setRecording(false);if(blob.size)void sendMedia(blob,"audio",Date.now()-recordingStartedAtRef.current);};
      mediaRecorderRef.current=recorder;recorder.start();recordingStartedAtRef.current=Date.now();setRecording(true);
    }catch(err){setError(err instanceof Error?err.message:"Microphone permission was denied");setRecording(false);}
  };

  if(loading)return <div className="w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] bg-background overflow-y-auto"><LoadingSkeleton variant="chat"/></div>;
  if(error&&!user)return <div className="w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] bg-background flex flex-col items-center justify-center gap-4 px-6"><p className="text-red-300/70 text-sm text-center">{error}</p><button onClick={()=>setLocation("/messages")} className="px-4 py-2 rounded-xl text-white text-sm" style={{background:GRADIENT}}>Back</button></div>;
  if(!user)return null;

  return <div className="w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] min-h-0 flex flex-col overflow-hidden" style={{background:"#050509"}}>
    <header className="relative z-40 shrink-0 px-3 pt-[max(10px,env(safe-area-inset-top,0px))] pb-3 flex items-center gap-2.5" style={{background:"rgba(5,5,9,0.96)",backdropFilter:"blur(22px)",borderBottom:"1px solid rgba(255,255,255,0.055)"}}>
      <button onClick={()=>setLocation("/messages")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-label="Back to messages"><ArrowLeft size={23} className="text-white/90" strokeWidth={2}/></button>
      <button onClick={()=>setLocation("/user/"+user.id)} className="min-w-0 flex-1 flex items-center gap-2.5 text-left">
        <div className="relative shrink-0">
          <img src={avatar(user)} alt={user.displayName} className="w-11 h-11 rounded-full object-cover"/>
          <span className={"absolute right-0 bottom-0 w-3 h-3 rounded-full border-2 border-[#050509] "+(otherOnline?"bg-[#35d16f]":"bg-white/20")}/>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-white font-semibold text-[16px] leading-tight truncate">{nickname||user.displayName}</span>
            {user.verified&&<BadgeCheck size={13} className="shrink-0 text-blue-400 fill-blue-400"/>}
          </div>
          <span className="block text-white/45 text-[12px] leading-tight mt-0.5 truncate">{otherTyping?"typing…":otherOnline?"online":otherActiveAt?"active recently":"@"+user.username}</span>
        </div>
      </button>
      <div className="shrink-0 flex items-center gap-1">
        <button onClick={()=>setLocation("/voice-call/"+user.id)} className="flex h-10 w-10 items-center justify-center rounded-full" aria-label="Voice call"><Phone size={22} className="text-white/80" strokeWidth={1.8}/></button>
        <button onClick={()=>setLocation("/video-call/"+user.id)} className="flex h-10 w-10 items-center justify-center rounded-full" aria-label="Video call"><Video size={22} className="text-white/80" strokeWidth={1.8}/></button>
        <button onClick={()=>setShowChatMenu(true)} className="flex h-10 w-10 items-center justify-center rounded-full" aria-label="Chat options"><MoreHorizontal size={23} className="text-white/80" strokeWidth={1.8}/></button>
      </div>
    </header>
    {error&&<div className="shrink-0 px-3 py-2 text-xs text-red-300/80 bg-red-500/5">{error}</div>}
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 pb-28" data-testid="messages-container">
      {messages.length===0?<div className="h-full flex items-center justify-center text-white/30 text-sm">Start the conversation.</div>:messages.map(msg=>{
        const isMe=Number(msg.senderId)===Number(authUser?.id);
        return <div key={msg.id} className={"flex w-full mb-5 "+(isMe?"justify-end":"justify-start")}>
          {!isMe&&<img src={avatar(user)} alt="" className="w-9 h-9 rounded-full object-cover mr-2 mt-auto flex-shrink-0 border-2 border-pink-400/70"/>}
          <div className={"min-w-0 max-w-[78%] "+(isMe?"items-end":"items-start")+" flex flex-col"}>
            <button type="button" onClick={()=>setSelectedMessage(msg)} className="block w-fit max-w-full text-left">
              {msg.replyToMessageId&&<div className="text-white/40 text-[10px] mb-1 px-2">Reply to message</div>}
              {msg.deleted?<div className="px-5 py-3.5 rounded-[24px] text-[16px] leading-[1.28] font-medium italic text-white/40 border border-white/10">This message was deleted</div>:((msg.type==="image"||msg.type==="sticker")&&msg.imageUrl)?<img src={msg.imageUrl} alt="Photo" className="max-w-[240px] rounded-2xl max-h-[320px] object-cover"/>:msg.type==="video"&&msg.videoUrl?<video src={msg.videoUrl} controls preload="metadata" className="max-w-[260px] rounded-2xl max-h-[320px]"/>:msg.type==="audio"&&msg.audioUrl?<audio src={msg.audioUrl} controls className="max-w-[230px] h-10"/>:msg.type==="file"&&msg.fileUrl?<a href={msg.fileUrl} download={msg.fileName??undefined} className="block px-3.5 py-2.5 rounded-2xl text-sm text-white underline">{msg.fileName||"Download file"}</a>:<div className={"max-w-full px-5 py-3.5 rounded-[24px] text-[16px] leading-[1.28] font-medium whitespace-pre-wrap break-words "+(isMe?"rounded-br-sm text-white":"rounded-bl-sm text-white/90")} style={{background:isMe?GRADIENT:"rgba(24,23,31,.9)"}}>{msg.text}</div>}
            </button>
            {msg.reactions.length>0&&<div className="flex gap-1 mt-1">{msg.reactions.map(r=><span key={r.reaction} className="rounded-full px-1.5 py-0.5 text-[10px] bg-white/10 text-white/70">{r.reaction}{r.count>1?" "+r.count:""}</span>)}</div>}
            <span className="text-white/30 text-[10px] mt-1 px-1">{formatTime(msg.timestamp)} {isMe?(msg.read?"Seen":msg.delivered?"Delivered":"Sent"):""} {msg.edited?"· edited":""}</span>
          </div>
        </div>;
      })}<div ref={bottomRef}/>
    </div>

    {selectedMediaPreview&&<ScreenPortal><div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center"><div className="w-full max-w-[430px] p-4 rounded-t-3xl bg-[#120f1e]"><img src={selectedMediaPreview} alt="Preview" className="w-full max-h-[55vh] object-contain rounded-2xl mb-3"/><div className="flex gap-2"><button onClick={()=>{setSelectedMediaFile(null);setSelectedMediaPreview(current=>{if(current)URL.revokeObjectURL(current);return null;});}} className="flex-1 py-3 rounded-xl bg-white/10 text-white/70">Cancel</button><button onClick={()=>void confirmMedia()} className="flex-1 py-3 rounded-xl text-white" style={{background:GRADIENT}}>Send</button></div></div></div></ScreenPortal>}

    {incomingCall&&<ScreenPortal><div className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center"><div className="w-full max-w-[430px] rounded-t-3xl p-5" style={{background:"rgba(18,15,30,0.99)"}}><div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4"/><div className="flex items-center gap-3 mb-5"><img src={incomingCall.user.avatarUrl??"https://api.dicebear.com/9.x/initials/svg?seed="+encodeURIComponent(incomingCall.user.displayName)} alt="" className="w-12 h-12 rounded-full object-cover"/><div><p className="text-white font-semibold">{incomingCall.user.displayName}</p><p className="text-white/45 text-sm">{incomingCall.callType==="video"?"Appel vidéo entrant":"Appel audio entrant"}</p></div></div><div className="flex gap-3"><button onClick={async()=>{await apiJson("/calls/"+encodeURIComponent(incomingCall.roomId)+"/reject",{method:"POST",body:JSON.stringify({callerId:incomingCall.callerId})}).catch(()=>{});setIncomingCall(null)}} className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-300">Refuser</button><button onClick={()=>{const call=incomingCall;setIncomingCall(null);setLocation("/"+(call.callType==="video"?"video-call/":"voice-call/")+call.callerId+"?callId="+encodeURIComponent(call.roomId)+"&incoming=1")}} className="flex-1 py-3 rounded-xl text-white" style={{background:"linear-gradient(135deg,#FF1493,#008CFF)"}}>Répondre</button></div></div></div></ScreenPortal>}

    {showChatMenu&&<ScreenPortal><><div className="fixed inset-0 z-50 bg-black/60" onClick={()=>setShowChatMenu(false)}/><div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-3xl overflow-hidden" style={{background:"rgba(18,15,30,0.99)"}} data-testid="chat-options-panel">
      <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-2"/>
      <div className="px-5 py-4 border-b border-white/10"><p className="text-white font-semibold text-sm">Chat</p><p className="text-white/40 text-xs mt-1">@{user.username}</p></div>
      <button onClick={()=>void updateChatSettings({readReceiptsEnabled:!readReceiptsEnabled})} className="w-full px-5 py-4 flex items-center gap-3 text-left border-b border-white/10"><span className="text-white/85 text-sm flex-1">Confirmation de lecture</span><span className={"text-xs "+(readReceiptsEnabled?"text-pink-300":"text-white/35")}>{readReceiptsEnabled?"Activée":"Désactivée"}</span></button>
      <button onClick={()=>void markConversationUnread()} className="w-full px-5 py-4 text-left text-white/85 text-sm border-b border-white/10">Marquer comme non lu</button>
      <button onClick={()=>void setChatNickname()} className="w-full px-5 py-4 flex items-center gap-3 text-left border-b border-white/10"><span className="text-white/85 text-sm flex-1">Pseudo</span><span className="text-white/35 text-xs truncate max-w-[150px]">{nickname||"Définir"}</span></button>
      <button onClick={()=>void blockUser()} className="w-full px-5 py-4 text-left text-red-300 text-sm">Bloquer</button>
      <div className="h-5"/>
    </div></></ScreenPortal>}

    {selectedMessage&&<ScreenPortal><><div className="fixed inset-0 z-50 bg-black/60" onClick={()=>setSelectedMessage(null)}/><div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-3xl overflow-hidden" style={{background:"rgba(18,15,30,0.99)"}}><div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-2"/><div className="grid grid-cols-6 gap-1 px-4 py-3 border-b border-white/10">{["❤️","😂","😮","😢","🔥","👏"].map(r=><button key={r} onClick={()=>void react(r)} className="text-xl py-2">{r}</button>)}</div><button onClick={()=>{setReplyingTo(selectedMessage);setEditingMessage(null);setSelectedMessage(null);}} className="w-full px-5 py-4 text-left text-white/85 text-sm border-b border-white/10">Reply</button>{selectedMessage.senderId===Number(authUser?.id)&&selectedMessage.type==="text"&&!selectedMessage.deleted&&<button onClick={()=>{setEditingMessage(selectedMessage);setReplyingTo(null);setInputText(selectedMessage.text??"");setSelectedMessage(null);}} className="w-full px-5 py-4 text-left text-white/85 text-sm border-b border-white/10">Edit</button>}<button onClick={()=>void forwardMessage()} className="w-full px-5 py-4 text-left text-white/85 text-sm border-b border-white/10">Forward</button><button onClick={()=>void reportMessage()} className="w-full px-5 py-4 text-left text-orange-300 text-sm border-b border-white/10">Report</button><button onClick={()=>void blockUser()} className="w-full px-5 py-4 text-left text-red-300 text-sm border-b border-white/10">Block user</button>{selectedMessage.senderId===Number(authUser?.id)&&<button onClick={()=>void deleteMessage(true)} className="w-full px-5 py-4 text-left text-red-300 text-sm border-b border-white/10">Delete for everyone</button>}<button onClick={()=>void deleteMessage(false)} className="w-full px-5 py-4 text-left text-red-300 text-sm">Delete for me</button><div className="h-5"/></div></></ScreenPortal>}

    <ScreenPortal><div className="fixed inset-x-0 mx-auto w-full max-w-[430px] px-3 py-3 z-40" style={{background:"rgba(13,11,20,0.95)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.07)",bottom:"var(--yuniko-keyboard-offset, 0px)",paddingBottom:"max(12px, env(safe-area-inset-bottom, 0px))",boxSizing:"border-box"}}>
      {(replyingTo||editingMessage)&&<div className="mb-2 rounded-xl px-3 py-2 bg-black/70 border border-white/10 flex items-center gap-2"><span className="text-white/50 text-[11px] flex-1 truncate">{editingMessage?"Editing: "+(editingMessage.text??""):"Reply: "+(replyingTo?.text??"message")}</span><button onClick={()=>{setReplyingTo(null);setEditingMessage(null);setInputText("");}} className="text-white/60 text-xs">Cancel</button></div>}
      <div className="flex items-center gap-2 min-w-0 rounded-full p-[2px]" style={{background:GRADIENT,boxShadow:"0 0 18px rgba(255,20,147,.16)"}}>
        <input ref={mediaInputRef} type="file" accept="image/*,video/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.zip" className="hidden" onChange={chooseMedia}/>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={chooseMedia}/>
        <button onClick={()=>mediaInputRef.current?.click()} disabled={mediaSending||recording} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{background:GRADIENT,boxShadow:"0 0 14px rgba(255,20,147,.25)"}}><span className="text-white text-[31px] font-light leading-none">+</span></button>
        <div className="min-w-0 flex-1 flex items-center gap-2 px-3 py-2.5 rounded-full" style={{background:"#0b0a10"}}>
          <input value={inputText} onChange={e=>handleInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void(editingMessage?editMessage():sendMessage());}} placeholder={editingMessage?"Edit message":t("typeMessage")} className="min-w-0 flex-1 bg-transparent text-white/85 text-[16px] outline-none placeholder:text-white/30" data-testid="input-message"/>
          <button><Smile size={18} className="text-white/40"/></button>
        </div>
        {inputText.trim()?<button onClick={()=>void(editingMessage?editMessage():sendMessage())} disabled={sending||mediaSending} className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center" style={{background:GRADIENT,boxShadow:"0 0 12px rgba(255,20,147,.2)"}}><Send size={16} className="text-white"/></button>:<button onClick={()=>void toggleRecording()} disabled={mediaSending} className="shrink-0 px-1"><Mic size={25} style={{color:recording?"#ff4d4d":"rgba(255,255,255,.72)"}}/></button>}
      </div>
    </div></ScreenPortal>
  </div>;
}
