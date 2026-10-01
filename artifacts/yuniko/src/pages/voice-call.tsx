import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { apiJson } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function VoiceCall(){
  const [,setLocation]=useLocation();
  const params=useParams<{userId:string}>();
  const userId=Number(params?.userId);
  const query=new URLSearchParams(window.location.search);
  const incoming=query.get("incoming")==="1";
  const initialCallId=Number(query.get("callId")||0);
  const [callId,setCallId]=useState(initialCallId);
  const [name,setName]=useState("Appel");
  const [avatarUrl,setAvatarUrl]=useState<string|null>(null);
  const [state,setState]=useState<"connecting"|"active"|"ended"|"error">("connecting");
  const [muted,setMuted]=useState(false);
  const [speakerOn,setSpeakerOn]=useState(false);
  const [duration,setDuration]=useState(0);
  const pcRef=useRef<RTCPeerConnection|null>(null);
  const localStreamRef=useRef<MediaStream|null>(null);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const lastSignalRef=useRef(0);
  const pendingCandidatesRef=useRef<RTCIceCandidateInit[]>([]);

  const signal=async(id:number,kind:string,payload:unknown)=>{
    await apiJson("/calls/"+id+"/signal",{method:"POST",body:JSON.stringify({kind,payload})});
  };
  const end=async()=>{
    const id=callId;
    setState("ended");
    localStreamRef.current?.getTracks().forEach(track=>track.stop());
    pcRef.current?.close();
    if(id)try{await apiJson("/calls/"+id+"/end",{method:"POST"});}catch{}
    window.setTimeout(()=>setLocation("/chat/"+userId),700);
  };

  useEffect(()=>{
    let cancelled=false;let pollTimer:number|undefined;
    const start=async()=>{
      try{
        let id=callId;
        if(!id){
          const data=await apiJson<{call:{id:number}} >("/calls/start",{method:"POST",body:JSON.stringify({calleeId:userId,callType:"voice"})});
          id=data.call.id;setCallId(id);
        }
        const info=await apiJson<{call:{user:{displayName:string;avatarUrl:string|null}|null}} >("/calls/"+id);
        if(info.call.user){setName(info.call.user.displayName);setAvatarUrl(info.call.user.avatarUrl);}
        if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==="undefined")throw new Error("WebRTC unavailable");
        const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
        pcRef.current=pc;
        const local=await navigator.mediaDevices.getUserMedia({audio:true});
        localStreamRef.current=local;
        local.getAudioTracks().forEach(track=>pc.addTrack(track,local));
        pc.ontrack=event=>{
          const stream=event.streams[0]??new MediaStream([event.track]);
          if(audioRef.current){audioRef.current.srcObject=stream;audioRef.current.volume=speakerOn?1:0.75;void audioRef.current.play().catch(()=>{});}
          setState("active");
        };
        pc.onicecandidate=event=>{if(event.candidate)void signal(id,"ice-candidate",event.candidate.toJSON());};
        if(!incoming){
          const offer=await pc.createOffer();
          await pc.setLocalDescription(offer);
          await signal(id,"offer",offer);
        }else{
          await apiJson("/calls/"+id+"/answer",{method:"POST"});
        }
        pollTimer=window.setInterval(async()=>{
          try{
            const data=await apiJson<{signals:Array<{id:number;kind:string;payload:any}>}>("/calls/"+id+"/signals?after="+lastSignalRef.current);
            for(const signalRow of data.signals){
              lastSignalRef.current=Math.max(lastSignalRef.current,signalRow.id);
              if(signalRow.kind==="offer"&&!pc.currentRemoteDescription){
                await pc.setRemoteDescription(signalRow.payload);
                for(const candidate of pendingCandidatesRef.current)await pc.addIceCandidate(candidate).catch(()=>{});
                pendingCandidatesRef.current=[];
                const answer=await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await signal(id,"answer",answer);
              }else if(signalRow.kind==="answer"&&!pc.currentRemoteDescription){
                await pc.setRemoteDescription(signalRow.payload);
                for(const candidate of pendingCandidatesRef.current)await pc.addIceCandidate(candidate).catch(()=>{});
                pendingCandidatesRef.current=[];
                setState("active");
              }else if(signalRow.kind==="ice-candidate"){
                if(pc.remoteDescription)await pc.addIceCandidate(signalRow.payload).catch(()=>{});
                else pendingCandidatesRef.current.push(signalRow.payload);
              }
            }
            const current=await apiJson<{call:{status:string}}>("/calls/"+id);
            if(["ended","rejected"].includes(current.call.status)&&!cancelled)setState("ended");
          }catch{}
        },700);
      }catch{if(!cancelled)setState("error");}
    };
    void start();
    return()=>{cancelled=true;if(pollTimer)window.clearInterval(pollTimer);pcRef.current?.close();localStreamRef.current?.getTracks().forEach(track=>track.stop());};
  },[]);

  useEffect(()=>{if(audioRef.current)audioRef.current.volume=speakerOn?1:0.75;},[speakerOn]);
  useEffect(()=>{if(state!=="active")return;const timer=window.setInterval(()=>setDuration(value=>value+1),1000);return()=>window.clearInterval(timer);},[state]);

  const toggleMute=()=>{const next=!muted;localStreamRef.current?.getAudioTracks().forEach(track=>track.enabled=!next);setMuted(next);};
  const format=(seconds:number)=>String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");

  if(state==="error")return <div className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0D0B14]"><p className="text-white/60 text-sm">Impossible de démarrer l’appel.</p><button onClick={()=>setLocation("/chat/"+userId)} className="px-4 py-2 rounded-xl text-white" style={{background:"linear-gradient(135deg,#FF006E,#8B00FF)"}}>Retour</button></div>;
  if(state==="ended")return <div className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0D0B14]"><p className="text-white/60 text-lg">{t("callEnded")}</p><p className="text-white/40 text-sm">{format(duration)}</p></div>;

  return <div className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center bg-[#0D0B14] text-white">
    <img src={avatarUrl??"https://api.dicebear.com/9.x/initials/svg?seed="+encodeURIComponent(name)} alt="" className="w-28 h-28 rounded-full object-cover mb-5"/>
    <p className="font-bold text-2xl">{name}</p><p className="text-sm text-white/50 mt-2">{state==="active"?format(duration):t("calling")}</p>
    <audio ref={audioRef} autoPlay playsInline className="hidden"/>
    <div className="flex items-center gap-7 mt-20">
      <button onClick={toggleMute} className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">{muted?<MicOff size={22}/>:<Mic size={22}/>}</button>
      <button onClick={()=>void end()} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center"><PhoneOff size={26}/></button>
      <button onClick={()=>setSpeakerOn(value=>!value)} className={"w-14 h-14 rounded-full flex items-center justify-center "+(speakerOn?"bg-white/20":"bg-white/10")}>{speakerOn?<Volume2 size={22}/>:<VolumeX size={22}/>}</button>
    </div>
  </div>;
}