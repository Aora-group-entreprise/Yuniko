import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { CameraOff, Camera, MicOff, Mic, PhoneOff, SwitchCamera } from "lucide-react";
import { apiJson } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function VideoCall(){
  const [,setLocation]=useLocation();
  const params=useParams<{userId:string}>();
  const userId=Number(params?.userId);
  const query=new URLSearchParams(window.location.search);
  const incoming=query.get("incoming")==="1";
  const initialCallId=Number(query.get("callId")||0);
  const [callId,setCallId]=useState(initialCallId);
  const [name,setName]=useState("Appel vidéo");
  const [state,setState]=useState<"connecting"|"active"|"ended"|"error">("connecting");
  const [muted,setMuted]=useState(false);
  const [cameraOff,setCameraOff]=useState(false);
  const [duration,setDuration]=useState(0);
  const [facingMode,setFacingMode]=useState<"user"|"environment">("user");
  const remoteRef=useRef<HTMLVideoElement|null>(null);
  const localRef=useRef<HTMLVideoElement|null>(null);
  const pcRef=useRef<RTCPeerConnection|null>(null);
  const localStreamRef=useRef<MediaStream|null>(null);
  const lastSignalRef=useRef(0);
  const pendingCandidatesRef=useRef<RTCIceCandidateInit[]>([]);

  const signal=async(id:number,kind:string,payload:unknown)=>{await apiJson("/calls/"+id+"/signal",{method:"POST",body:JSON.stringify({kind,payload})});};
  const end=async()=>{const id=callId;setState("ended");localStreamRef.current?.getTracks().forEach(track=>track.stop());pcRef.current?.close();if(id)try{await apiJson("/calls/"+id+"/end",{method:"POST"});}catch{}window.setTimeout(()=>setLocation("/chat/"+userId),700);};

  useEffect(()=>{
    let cancelled=false;let pollTimer:number|undefined;
    const start=async()=>{
      try{
        let id=callId;
        if(!id){const data=await apiJson<{call:{id:number}} >("/calls/start",{method:"POST",body:JSON.stringify({calleeId:userId,callType:"video"})});id=data.call.id;setCallId(id);}
        const info=await apiJson<{call:{user:{displayName:string;avatarUrl:string|null}|null}} >("/calls/"+id);
        if(info.call.user)setName(info.call.user.displayName);
        if(!navigator.mediaDevices?.getUserMedia||typeof RTCPeerConnection==="undefined")throw new Error("WebRTC unavailable");
        const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});pcRef.current=pc;
        const local=await navigator.mediaDevices.getUserMedia({audio:true,video:{facingMode}});
        localStreamRef.current=local;
        if(localRef.current)localRef.current.srcObject=local;
        local.getTracks().forEach(track=>pc.addTrack(track,local));
        pc.ontrack=event=>{if(remoteRef.current){remoteRef.current.srcObject=event.streams[0]??new MediaStream([event.track]);void remoteRef.current.play().catch(()=>{});}setState("active");};
        pc.onicecandidate=event=>{if(event.candidate)void signal(id,"ice-candidate",event.candidate.toJSON());};
        if(!incoming){const offer=await pc.createOffer();await pc.setLocalDescription(offer);await signal(id,"offer",offer);}else await apiJson("/calls/"+id+"/answer",{method:"POST"});
        pollTimer=window.setInterval(async()=>{
          try{
            const data=await apiJson<{signals:Array<{id:number;kind:string;payload:any}>}>("/calls/"+id+"/signals?after="+lastSignalRef.current);
            for(const signalRow of data.signals){
              lastSignalRef.current=Math.max(lastSignalRef.current,signalRow.id);
              if(signalRow.kind==="offer"&&!pc.currentRemoteDescription){
                await pc.setRemoteDescription(signalRow.payload);
                for(const candidate of pendingCandidatesRef.current)await pc.addIceCandidate(candidate).catch(()=>{});
                pendingCandidatesRef.current=[];
                const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await signal(id,"answer",answer);
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

  useEffect(()=>{if(state!=="active")return;const timer=window.setInterval(()=>setDuration(value=>value+1),1000);return()=>window.clearInterval(timer);},[state]);
  const toggleMute=()=>{const next=!muted;localStreamRef.current?.getAudioTracks().forEach(track=>track.enabled=!next);setMuted(next);};
  const toggleCamera=()=>{const next=!cameraOff;localStreamRef.current?.getVideoTracks().forEach(track=>track.enabled=!next);setCameraOff(next);};
  const switchCamera=async()=>{
    const next=facingMode==="user"?"environment":"user";
    try{
      const current=localStreamRef.current?.getVideoTracks()[0];
      if(!current)return;
      const replacementStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:next}});
      const replacement=replacementStream.getVideoTracks()[0];
      const sender=pcRef.current?.getSenders().find(item=>item.track?.kind==="video");
      if(sender)await sender.replaceTrack(replacement);
      current.stop();
      localStreamRef.current?.removeTrack(current);
      localStreamRef.current?.addTrack(replacement);
      if(localRef.current)localRef.current.srcObject=localStreamRef.current;
      setFacingMode(next);
    }catch{}
  };

  if(state==="error")return <div className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-4 bg-black"><p className="text-white/60 text-sm">Impossible de démarrer l’appel vidéo.</p><button onClick={()=>setLocation("/chat/"+userId)} className="px-4 py-2 rounded-xl text-white" style={{background:"linear-gradient(135deg,#FF006E,#8B00FF)"}}>Retour</button></div>;
  if(state==="ended")return <div className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-4 bg-black"><p className="text-white/60 text-lg">{t("callEnded")}</p><p className="text-white/40 text-sm">{String(Math.floor(duration/60)).padStart(2,"0")+":"+String(duration%60).padStart(2,"0")}</p></div>;

  return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-black relative overflow-hidden text-white">
    <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-[#0A0A0F]"/>
    <video ref={localRef} autoPlay muted playsInline className="absolute top-6 right-4 w-24 h-32 rounded-2xl object-cover border border-white/20 bg-black"/>
    <div className="absolute top-5 left-4 right-32"><p className="font-semibold">{name}</p><p className="text-white/50 text-sm">{state==="active"?String(Math.floor(duration/60)).padStart(2,"0")+":"+String(duration%60).padStart(2,"0"):t("calling")}</p></div>
    <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-5">
      <button onClick={toggleMute} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">{muted?<MicOff size={21}/>:<Mic size={21}/>}</button>
      <button onClick={toggleCamera} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">{cameraOff?<CameraOff size={21}/>:<Camera size={21}/>}</button>
      <button onClick={()=>void end()} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center"><PhoneOff size={25}/></button>
      <button onClick={()=>void switchCamera()} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center"><SwitchCamera size={21}/></button>
    </div>
  </div>;
}