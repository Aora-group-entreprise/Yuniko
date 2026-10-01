import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Phone, Video, MoreHorizontal, Image as ImageIcon, Smile, Mic, Send, Camera, BadgeCheck } from "lucide-react";
import { t } from "@/lib/i18n";
import ScreenPortal from "@/components/ScreenPortal";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { fetchSessionJson, getSessionCache, invalidateSessionCache, setSessionUser } from "@/lib/session-cache";

type Reaction={reaction:string;count:number;reacted:boolean};
type Message={
  id:number;senderId:number;text?:string;imageUrl?:string;audioUrl?:string;videoUrl?:string;fileUrl?:string;
  fileName?:string|null;fileSize?:number|null;mediaMimeType?:string|null;durationMs?:number|null;
  timestamp:string|null;read:boolean;delivered?:boolean;edited?:boolean;deleted?:boolean;
  replyToMessageId?:number|null;forwardedFromMessageId?:number|null;reactions:Reaction[];
  type:"text"|"image"|"audio"|"video"|"file"|"sticker";
};
type ChatUser={id:number;username:string;displayName:string;avatarUrl:string|null;verified:boolean};
const GRADIENT="linear-gradient(135deg,#FF006E 0%,#8B00FF 100%)";

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
  const cached=cacheKey?getSessionCache<{user:ChatUser;messages:Message[];otherTyping?:boolean;otherActiveAt?:string|null}>(cacheKey):undefined;
  const [user,setUser]=useState<ChatUser|null>(()=>cached?.user??null);
  const [messages,setMessages]=useState<Message[]>(()=>cached?.messages??[]);
  const [inputText,setInputText]=useState("");
  const [loading,setLoading]=useState(!cached);
  const [sending,setSending]=useState(false);
  const [mediaSending,setMediaSending]=useState(false);
  const [recording,setRecording]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [otherTyping,setOtherTyping]=useState(Boolean(cached?.otherTyping));
  const [otherActiveAt,setOtherActiveAt]=useState<string|null>(cached?.otherActiveAt??null);
  const [selectedMessage,setSelectedMessage]=useState<Message|null>(null);
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
      const data=await fetchSessionJson<{user:ChatUser;messages:Message[];otherTyping?:boolean;otherActiveAt?:string|null}>("/messages/conversations/"+userId);
      setUser(data.user);setMessages(data.messages??[]);setOtherTyping(Boolean(data.otherTyping));setOtherActiveAt(data.otherActiveAt??null);
      lastMessageIdRef.current=Math.max(0,...(data.messages??[]).map(m=>m.id));
    }catch(err){setError(err instanceof Error?err.message:"Unable to load chat");}
    finally{setLoading(false);}
  };

  useEffect(()=>{void load();},[userId]);

  useEffect(()=>{
    if(!Number.isInteger(userId)||userId<=0)return;
    let cancelled=false;
    const poll=async()=>{
      if(cancelled||document.visibilityState==="hidden")return;
      try{
        const data=await fetchSessionJson<{messages:Message[];otherTyping?:boolean;otherActiveAt?:string|null}>("/messages/conversations/"+userId+"?after="+lastMessageIdRef.current);
        if(cancelled)return;
        if(data.messages?.length){
          setMessages(current=>{
            const known=new Set(current.map(m=>m.id));
            return current.concat(data.messages.filter(m=>!known.has(m.id)));
          });
          lastMessageIdRef.current=Math.max(lastMessageIdRef.current,...data.messages.map(m=>m.id));
        }
        setOtherTyping(Boolean(data.otherTyping));setOtherActiveAt(data.otherActiveAt??null);
      }catch{}
    };
    const interval=window.setInterval(()=>void poll(),1500);
    void poll();
    const onVisible=()=>{if(document.visibilityState==="visible")void poll();};
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("online",onVisible);
    return()=>{cancelled=true;window.clearInterval(interval);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("online",onVisible);};
  },[userId]);

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
      const data=await apiJson<{message:Message}>("/messages/conversations/"+user.id,{method:"POST",body:JSON.stringify({text,replyToMessageId:replyingTo?.id??null})});
      setMessages(current=>current.concat(data.message));lastMessageIdRef.current=Math.max(lastMessageIdRef.current,data.message.id);
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
    await sendMedia(file,kind,file.type==="image/gif"?"gif":file.name);
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
    finally{setSelectedMessage(null);}
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

  return <div className="w-full max-w-[430px] mx-auto h-[var(--yuniko-vh)] min-h-0 bg-background flex flex-col overflow-hidden">
    <header className="relative z-40 shrink-0 px-4 py-3 flex items-center gap-3" style={{background:"rgba(13,11,20,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
      <button onClick={()=>setLocation("/messages")}><ArrowLeft size={22} className="text-white/80"/></button>
      <button onClick={()=>setLocation("/user/"+user.id)} className="flex items-center gap-2.5 flex-1 text-left">
        <img src={avatar(user)} alt={user.displayName} className="w-9 h-9 rounded-full object-cover"/>
        <div><div className="flex items-center gap-1"><span className="text-white font-semibold text-sm">{user.displayName}</span>{user.verified&&<BadgeCheck size={13} className="text-blue-400 fill-blue-400"/>}</div><span className="text-white/50 text-xs">{otherTyping?"typing…":otherActiveAt?"active recently":"@"+user.username}</span></div>
      </button>
      <div className="flex items-center gap-2"><button onClick={()=>setLocation("/voice-call")}><Phone size={20} className="text-white/70"/></button><button onClick={()=>setLocation("/video-call")}><Video size={20} className="text-white/70"/></button><button><MoreHorizontal size={20} className="text-white/70"/></button></div>
    </header>
    {error&&<div className="shrink-0 px-3 py-2 text-xs text-red-300/80 bg-red-500/5">{error}</div>}
    <div className="flex-1 overflow-y-auto px-3 py-4 pb-2" data-testid="messages-container">
      {messages.length===0?<div className="h-full flex items-center justify-center text-white/30 text-sm">Start the conversation.</div>:messages.map(msg=>{
        const isMe=Number(msg.senderId)===Number(authUser?.id);
        return <div key={msg.id} className={"flex mb-2 "+(isMe?"justify-end":"justify-start")}>
          {!isMe&&<img src={avatar(user)} alt="" className="w-7 h-7 rounded-full object-cover mr-2 mt-auto flex-shrink-0"/>}
          <div className={"max-w-[75%] "+(isMe?"items-end":"items-start")+" flex flex-col"}>
            <button type="button" onClick={()=>setSelectedMessage(msg)} className="text-left">
              {msg.replyToMessageId&&<div className="text-white/40 text-[10px] mb-1 px-2">Reply to message</div>}
              {msg.deleted?<div className="px-3.5 py-2.5 rounded-2xl text-sm italic text-white/40 border border-white/10">This message was deleted</div>:((msg.type==="image"||msg.type==="sticker")&&msg.imageUrl)?<img src={msg.imageUrl} alt="Photo" className="max-w-[240px] rounded-2xl max-h-[320px] object-cover"/>:msg.type==="video"&&msg.videoUrl?<video src={msg.videoUrl} controls preload="metadata" className="max-w-[260px] rounded-2xl max-h-[320px]"/>:msg.type==="audio"&&msg.audioUrl?<audio src={msg.audioUrl} controls className="max-w-[230px] h-10"/>:msg.type==="file"&&msg.fileUrl?<a href={msg.fileUrl} download={msg.fileName??undefined} className="block px-3.5 py-2.5 rounded-2xl text-sm text-white underline">{msg.fileName||"Download file"}</a>:<div className={"px-3.5 py-2.5 rounded-2xl text-sm "+(isMe?"rounded-br-sm text-white":"rounded-bl-sm text-white/90")} style={{background:isMe?GRADIENT:"rgba(255,255,255,0.08)"}}>{msg.text}</div>}
            </button>
            {msg.reactions.length>0&&<div className="flex gap-1 mt-1">{msg.reactions.map(r=><span key={r.reaction} className="rounded-full px-1.5 py-0.5 text-[10px] bg-white/10 text-white/70">{r.reaction}{r.count>1?" "+r.count:""}</span>)}</div>}
            <span className="text-white/30 text-[10px] mt-1 px-1">{formatTime(msg.timestamp)} {isMe?(msg.read?"Seen":msg.delivered?"Delivered":"Sent"):""} {msg.edited?"· edited":""}</span>
          </div>
        </div>;
      })}<div ref={bottomRef}/>
    </div>

    {selectedMediaPreview&&<ScreenPortal><div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center"><div className="w-full max-w-[430px] p-4 rounded-t-3xl bg-[#120f1e]"><img src={selectedMediaPreview} alt="Preview" className="w-full max-h-[55vh] object-contain rounded-2xl mb-3"/><div className="flex gap-2"><button onClick={()=>{setSelectedMediaFile(null);setSelectedMediaPreview(current=>{if(current)URL.revokeObjectURL(current);return null;});}} className="flex-1 py-3 rounded-xl bg-white/10 text-white/70">Cancel</button><button onClick={()=>void confirmMedia()} className="flex-1 py-3 rounded-xl text-white" style={{background:GRADIENT}}>Send</button></div></div></div></ScreenPortal>}

    {selectedMessage&&<ScreenPortal><><div className="fixed inset-0 z-50 bg-black/60" onClick={()=>setSelectedMessage(null)}/><div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-3xl overflow-hidden" style={{background:"rgba(18,15,30,0.99)"}}><div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-2"/><div className="grid grid-cols-6 gap-1 px-4 py-3 border-b border-white/10">{["❤️","😂","😮","😢","🔥","👏"].map(r=><button key={r} onClick={()=>void react(r)} className="text-xl py-2">{r}</button>)}</div><button onClick={()=>{setReplyingTo(selectedMessage);setEditingMessage(null);setSelectedMessage(null);}} className="w-full px-5 py-4 text-left text-white/85 text-sm border-b border-white/10">Reply</button>{selectedMessage.senderId===Number(authUser?.id)&&selectedMessage.type==="text"&&!selectedMessage.deleted&&<button onClick={()=>{setEditingMessage(selectedMessage);setReplyingTo(null);setInputText(selectedMessage.text??"");setSelectedMessage(null);}} className="w-full px-5 py-4 text-left text-white/85 text-sm border-b border-white/10">Edit</button>}<button onClick={()=>void forwardMessage()} className="w-full px-5 py-4 text-left text-white/85 text-sm border-b border-white/10">Forward</button><button onClick={()=>void reportMessage()} className="w-full px-5 py-4 text-left text-orange-300 text-sm border-b border-white/10">Report</button><button onClick={()=>void blockUser()} className="w-full px-5 py-4 text-left text-red-300 text-sm border-b border-white/10">Block user</button>{selectedMessage.senderId===Number(authUser?.id)&&<button onClick={()=>void deleteMessage(true)} className="w-full px-5 py-4 text-left text-red-300 text-sm border-b border-white/10">Delete for everyone</button>}<button onClick={()=>void deleteMessage(false)} className="w-full px-5 py-4 text-left text-red-300 text-sm">Delete for me</button><div className="h-5"/></div></></ScreenPortal>}

    <ScreenPortal><div className="fixed inset-x-0 mx-auto w-full max-w-[430px] px-[clamp(8px,3vw,12px)] py-3" style={{background:"rgba(13,11,20,0.95)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.07)",bottom:"var(--yuniko-keyboard-offset, 0px)",paddingBottom:"max(12px, env(safe-area-inset-bottom, 0px))",boxSizing:"border-box"}}>
      {(replyingTo||editingMessage)&&<div className="mb-2 rounded-xl px-3 py-2 bg-black/70 border border-white/10 flex items-center gap-2"><span className="text-white/50 text-[11px] flex-1 truncate">{editingMessage?"Editing: "+(editingMessage.text??""):"Reply: "+(replyingTo?.text??"message")}</span><button onClick={()=>{setReplyingTo(null);setEditingMessage(null);setInputText("");}} className="text-white/60 text-xs">Cancel</button></div>}
      <div className="flex items-center gap-2">
        <input ref={mediaInputRef} type="file" accept="image/*,video/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.zip" className="hidden" onChange={chooseMedia}/>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={chooseMedia}/>
        <button onClick={()=>mediaInputRef.current?.click()} disabled={mediaSending||recording}><ImageIcon size={22} style={{color:"#FF3D9A"}}/></button>
        <button onClick={()=>cameraInputRef.current?.click()} disabled={mediaSending||recording}><Camera size={22} style={{color:"#FF3D9A"}}/></button>
        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-full" style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)"}}>
          <input value={inputText} onChange={e=>handleInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void(editingMessage?editMessage():sendMessage());}} placeholder={editingMessage?"Edit message":t("typeMessage")} className="flex-1 bg-transparent text-white/85 text-sm outline-none placeholder:text-white/30" data-testid="input-message"/>
          <button><Smile size={18} className="text-white/40"/></button>
        </div>
        {inputText.trim()?<button onClick={()=>void(editingMessage?editMessage():sendMessage())} disabled={sending||mediaSending} className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:GRADIENT}}><Send size={16} className="text-white"/></button>:<button onClick={()=>void toggleRecording()} disabled={mediaSending} className="flex-shrink-0"><Mic size={22} style={{color:recording?"#ff4d4d":"#FF3D9A"}}/></button>}
      </div>
    </div></ScreenPortal>
  </div>;
}
