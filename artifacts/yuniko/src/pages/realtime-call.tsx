import{useEffect,useRef,useState}from"react";import{useLocation,useParams}from"wouter";import{Camera,CameraOff,Mic,MicOff,PhoneOff,SwitchCamera,Volume2,VolumeX}from"lucide-react";import{apiJson}from"@/lib/api";
type Signal={type:string;payload?:any};
export default function RealtimeCall({mode}:{mode:"voice"|"video"}){
const[,go]=useLocation();const{userId}=useParams<{userId:string}>();const q=new URLSearchParams(location.search);const incoming=q.get("incoming")==="1";const roomId=q.get("callId")||"";
const[room,setRoom]=useState(roomId),[status,setStatus]=useState("connecting"),[muted,setMuted]=useState(false),[camOff,setCamOff]=useState(false),[speaker,setSpeaker]=useState(true),[duration,setDuration]=useState(0);
const pc=useRef<RTCPeerConnection|null>(null),stream=useRef<MediaStream|null>(null),local=useRef<HTMLVideoElement|null>(null),remote=useRef<HTMLVideoElement|null>(null),audio=useRef<HTMLAudioElement|null>(null),ws=useRef<WebSocket|null>(null),ice=useRef<RTCIceCandidateInit[]>([]),offered=useRef(false);
const send=(type:string,payload?:unknown)=>{if(ws.current?.readyState===WebSocket.OPEN)ws.current.send(JSON.stringify({type,payload}))};
useEffect(()=>{let dead=false;const run=async()=>{
try{
let id=room;
if(!id){const d=await apiJson<{call:{roomId:string}}>("/calls/start",{method:"POST",body:JSON.stringify({calleeId:Number(userId),callType:mode})});id=d.call.roomId;setRoom(id);}
if(!id)throw new Error("Call room unavailable");
if(incoming)await apiJson("/calls/"+encodeURIComponent(id)+"/answer",{method:"POST",body:JSON.stringify({callerId:Number(userId)})});
const scheme=location.protocol==="https:"?"wss":"ws";const socket=new WebSocket(scheme+"://"+location.host+"/api/calls/ws?scope=room&room="+encodeURIComponent(id));ws.current=socket;
const p=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});pc.current=p;
const media=await navigator.mediaDevices.getUserMedia({audio:true,video:mode==="video"});if(dead){media.getTracks().forEach(t=>t.stop());return}stream.current=media;if(local.current)local.current.srcObject=media;media.getTracks().forEach(t=>p.addTrack(t,media));
p.ontrack=e=>{const s=e.streams[0]||new MediaStream([e.track]);if(mode==="video"&&remote.current){remote.current.srcObject=s;void remote.current.play().catch(()=>{})}if(audio.current){audio.current.srcObject=s;audio.current.volume=speaker?1:0;void audio.current.play().catch(()=>{})}};
p.onicecandidate=e=>{if(e.candidate)send("ice",e.candidate.toJSON())};
p.onconnectionstatechange=()=>{const s=p.connectionState;if(s==="connected")setStatus("connected");else if(["failed","disconnected","closed"].includes(s))setStatus("ended")};
socket.onopen=()=>setStatus(incoming?"connecting":"ringing");
socket.onmessage=async event=>{try{const s=JSON.parse(String(event.data)) as Signal;
if(s.type==="call-accepted"&&!incoming&&!offered.current){offered.current=true;const o=await p.createOffer();await p.setLocalDescription(o);send("offer",o)}
else if(s.type==="offer"&&incoming){await p.setRemoteDescription(s.payload);for(const c of ice.current)await p.addIceCandidate(c).catch(()=>{});ice.current=[];const a=await p.createAnswer();await p.setLocalDescription(a);send("answer",a)}
else if(s.type==="answer"&&!incoming){await p.setRemoteDescription(s.payload)}
else if(s.type==="ice"){const c=s.payload as RTCIceCandidateInit;if(p.remoteDescription)await p.addIceCandidate(c).catch(()=>{});else ice.current.push(c)}
else if(s.type==="call-rejected"||s.type==="call-ended"||s.type==="hangup"){setStatus("ended");window.setTimeout(()=>go("/messages"),250)}
}catch{}};
socket.onerror=()=>{if(!dead)setStatus("signaling-error")};
}catch(e){if(!dead)setStatus(e instanceof Error?e.message:"Call failed")}};
void run();return()=>{dead=true;stream.current?.getTracks().forEach(t=>t.stop());pc.current?.close();ws.current?.close()};},[userId,mode,incoming]);
useEffect(()=>{if(status!=="connected")return;const t=window.setInterval(()=>setDuration(v=>v+1),1000);return()=>window.clearInterval(t)},[status]);
useEffect(()=>{if(audio.current)audio.current.volume=speaker?1:0},[speaker]);
const mute=()=>{const n=!muted;stream.current?.getAudioTracks().forEach(t=>t.enabled=!n);setMuted(n)};
const camera=()=>{const n=!camOff;stream.current?.getVideoTracks().forEach(t=>t.enabled=!n);setCamOff(n)};
const switchCamera=async()=>{const oldTrack=stream.current?.getVideoTracks()[0];if(!oldTrack||!navigator.mediaDevices?.getUserMedia)return;const facing=oldTrack.getSettings().facingMode==="environment"?"user":"environment";try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}},audio:false});const next=s.getVideoTracks()[0];if(!next)return;const sender=pc.current?.getSenders().find(x=>x.track?.kind==="video");if(sender)await sender.replaceTrack(next);oldTrack.stop();stream.current?.removeTrack(oldTrack);stream.current?.addTrack(next);if(local.current)local.current.srcObject=stream.current;setCamOff(false)}catch{}};
const end=async()=>{send("hangup");if(room)await apiJson("/calls/"+encodeURIComponent(room)+"/end",{method:"POST"}).catch(()=>{});stream.current?.getTracks().forEach(t=>t.stop());pc.current?.close();ws.current?.close();go("/messages")};
const time=String(Math.floor(duration/60)).padStart(2,"0")+":"+String(duration%60).padStart(2,"0");
return <div className="max-w-[430px] mx-auto h-[var(--yuniko-vh)] bg-black relative text-white overflow-hidden">
{mode==="video"?<video ref={remote} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black"/>:<div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">{status==="ringing"?"Appel en cours…":status==="connected"?time:status}</div>}
<video ref={local} autoPlay muted playsInline className={mode==="video"?"absolute top-5 right-4 w-24 h-32 object-cover rounded-2xl border border-white/20 bg-black":"hidden"}/><audio ref={audio} autoPlay playsInline className="hidden"/>
<div className="absolute top-5 left-4 text-sm text-white/75">{status==="connected"?time:mode==="video"?"Appel vidéo":"Appel audio"}</div>
<div className="absolute bottom-7 inset-x-0 flex justify-center items-center gap-4">
<button onClick={mute} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">{muted?<MicOff size={20}/>:<Mic size={20}/>}</button>
{mode==="video"&&<button onClick={camera} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">{camOff?<CameraOff size={20}/>:<Camera size={20}/>}</button>}
{mode==="voice"&&<button onClick={()=>setSpeaker(v=>!v)} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">{speaker?<Volume2 size={20}/>:<VolumeX size={20}/>}</button>}
<button onClick={()=>void end()} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center"><PhoneOff size={25}/></button>
{mode==="video"&&<button onClick={()=>void switchCamera()} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center"><SwitchCamera size={20}/></button>}
</div></div>}