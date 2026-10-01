import{useEffect,useRef,useState}from"react";import{useLocation,useParams}from"wouter";import{Camera,CameraOff,Mic,MicOff,PhoneOff,SwitchCamera,Volume2,VolumeX}from"lucide-react";import{apiJson}from"@/lib/api";
type Signal={type:string;payload?:any};
type PendingSignal={type:string;payload?:unknown};
export default function RealtimeCall({mode}:{mode:"voice"|"video"}){
const[,go]=useLocation();const{userId}=useParams<{userId:string}>();const q=new URLSearchParams(location.search);const incoming=q.get("incoming")==="1";const roomId=q.get("callId")||"";
const[room,setRoom]=useState(roomId),[status,setStatus]=useState("connecting"),[muted,setMuted]=useState(false),[camOff,setCamOff]=useState(false),[remoteMuted,setRemoteMuted]=useState(false),[duration,setDuration]=useState(0),[error,setError]=useState("");
const pc=useRef<RTCPeerConnection|null>(null),stream=useRef<MediaStream|null>(null),local=useRef<HTMLVideoElement|null>(null),remote=useRef<HTMLVideoElement|null>(null),audio=useRef<HTMLAudioElement|null>(null),ws=useRef<WebSocket|null>(null),ice=useRef<RTCIceCandidateInit[]>([]),offered=useRef(false),pending=useRef<PendingSignal[]>([]),disconnectTimer=useRef<number|null>(null),ended=useRef(false);
const finish=(delay=250)=>{if(ended.current)return;ended.current=true;setStatus("ended");if(delay)window.setTimeout(()=>go("/messages"),delay);else go("/messages")};
const send=(type:string,payload?:unknown)=>{const message={type,payload};if(ws.current?.readyState===WebSocket.OPEN)ws.current.send(JSON.stringify(message));else pending.current.push(message)};
const flush=()=>{if(ws.current?.readyState!==WebSocket.OPEN)return;for(const message of pending.current)ws.current.send(JSON.stringify(message));pending.current=[]};
useEffect(()=>{let dead=false;const run=async()=>{
try{
let id=room;
if(!id){const d=await apiJson<{call:{roomId:string}}>("/calls/start",{method:"POST",body:JSON.stringify({calleeId:Number(userId),callType:mode})});id=d.call.roomId;setRoom(id);}
if(!id)throw new Error("Call room unavailable");
const scheme=location.protocol==="https:"?"wss":"ws";const socket=new WebSocket(scheme+"://"+location.host+"/api/calls/ws?scope=room&room="+encodeURIComponent(id));ws.current=socket;
const p=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});pc.current=p;
const media=await navigator.mediaDevices.getUserMedia({audio:true,video:mode==="video"});if(dead){media.getTracks().forEach(t=>t.stop());return}stream.current=media;
media.getAudioTracks().forEach(t=>t.enabled=true);media.getVideoTracks().forEach(t=>t.enabled=true);
if(local.current){local.current.srcObject=media;void local.current.play().catch(()=>{});}
media.getTracks().forEach(t=>p.addTrack(t,media));
p.ontrack=e=>{const s=e.streams[0]||new MediaStream([e.track]);if(mode==="video"&&remote.current){remote.current.srcObject=s;void remote.current.play().catch(()=>{});}if(audio.current){audio.current.srcObject=s;audio.current.muted=remoteMuted;void audio.current.play().catch(()=>{});}};
p.onicecandidate=e=>{if(e.candidate)send("ice",e.candidate.toJSON());};
p.onconnectionstatechange=()=>{const s=p.connectionState;if(disconnectTimer.current){window.clearTimeout(disconnectTimer.current);disconnectTimer.current=null;}if(s==="connected")setStatus("connected");else if(s==="disconnected"){disconnectTimer.current=window.setTimeout(()=>{if(p.connectionState==="disconnected")finish();},5000);}else if(s==="failed"||s==="closed")finish();};
socket.onopen=async()=>{flush();if(dead)return;if(incoming){try{await apiJson("/calls/"+encodeURIComponent(id)+"/answer",{method:"POST",body:JSON.stringify({callerId:Number(userId)})});setStatus("connecting");}catch(e){setError(e instanceof Error?e.message:"Call is no longer available");finish(900);}}else setStatus("ringing");};
socket.onmessage=async event=>{try{const s=JSON.parse(String(event.data)) as Signal;
if(s.type==="call-accepted"&&!incoming&&!offered.current){offered.current=true;const o=await p.createOffer();await p.setLocalDescription(o);send("offer",o);}
else if(s.type==="offer"&&incoming){await p.setRemoteDescription(s.payload);for(const c of ice.current)await p.addIceCandidate(c).catch(()=>{});ice.current=[];const a=await p.createAnswer();await p.setLocalDescription(a);send("answer",a);}
else if(s.type==="answer"&&!incoming){await p.setRemoteDescription(s.payload);}
else if(s.type==="ice"){const c=s.payload as RTCIceCandidateInit;if(p.remoteDescription)await p.addIceCandidate(c).catch(()=>{});else ice.current.push(c);}
else if(s.type==="call-rejected"||s.type==="call-ended"||s.type==="call-timeout"||s.type==="hangup")finish();
}catch{}};
socket.onerror=()=>{if(!dead){setError("Connexion d'appel interrompue");finish(900);}};
socket.onclose=()=>{if(!dead&&pc.current?.connectionState!=="connected")finish(900);};
}catch(e){if(!dead){setError(e instanceof Error?e.message:"Call failed");finish(900);}}};
void run();return()=>{dead=true;if(disconnectTimer.current)window.clearTimeout(disconnectTimer.current);stream.current?.getTracks().forEach(t=>t.stop());pc.current?.getSenders().forEach(s=>s.track?.stop());pc.current?.close();ws.current?.close();};},[userId,mode,incoming]);
useEffect(()=>{if(status!=="connected")return;const t=window.setInterval(()=>setDuration(v=>v+1),1000);return()=>window.clearInterval(t)},[status]);
useEffect(()=>{if(audio.current)audio.current.muted=remoteMuted},[remoteMuted]);
const mute=()=>{const n=!muted;const tracks=stream.current?.getAudioTracks()??[];tracks.forEach(t=>t.enabled=!n);setMuted(n);};
const camera=()=>{if(mode!=="video")return;const n=!camOff;const tracks=stream.current?.getVideoTracks()??[];tracks.forEach(t=>t.enabled=!n);setCamOff(n);};
const switchCamera=async()=>{if(mode!=="video")return;const oldTrack=stream.current?.getVideoTracks()[0];if(!oldTrack||!navigator.mediaDevices?.getUserMedia)return;const facing=oldTrack.getSettings().facingMode==="environment"?"user":"environment";try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}},audio:false});const next=s.getVideoTracks()[0];if(!next)return;next.enabled=!camOff;const sender=pc.current?.getSenders().find(x=>x.track?.kind==="video");if(!sender){next.stop();return;}await sender.replaceTrack(next);oldTrack.stop();stream.current?.removeTrack(oldTrack);stream.current?.addTrack(next);if(local.current){local.current.srcObject=stream.current;void local.current.play().catch(()=>{});}}catch(e){setError(e instanceof Error?e.message:"Unable to switch camera");}};
const toggleRemoteSound=()=>setRemoteMuted(v=>!v);
const end=async()=>{if(ended.current)return;ended.current=true;send("hangup");if(room)await apiJson("/calls/"+encodeURIComponent(room)+"/end",{method:"POST"}).catch(()=>{});stream.current?.getTracks().forEach(t=>t.stop());pc.current?.close();ws.current?.close();go("/messages");};
const time=String(Math.floor(duration/60)).padStart(2,"0")+":"+String(duration%60).padStart(2,"0");
return <div className="max-w-[430px] mx-auto h-[var(--yuniko-vh)] bg-black relative text-white overflow-hidden">
{mode==="video"?<video ref={remote} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black"/>:<div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">{status==="ringing"?"Appel en cours…":status==="connected"?time:status==="ended"?"Appel terminé":status}</div>}
{mode==="video"&&<video ref={local} autoPlay muted playsInline className="absolute top-5 right-4 w-28 h-36 object-cover rounded-2xl border border-white/20 bg-black"/>}
<audio ref={audio} autoPlay playsInline className="hidden"/>
<div className="absolute top-5 left-4 text-sm text-white/75">{status==="connected"?time:mode==="video"?"Appel vidéo":"Appel audio"}</div>
{error&&<div className="absolute top-14 left-4 right-4 rounded-xl bg-red-500/15 border border-red-400/20 px-3 py-2 text-xs text-red-200 text-center">{error}</div>}
<div className="absolute bottom-7 inset-x-0 flex justify-center items-center gap-4">
<button type="button" onClick={mute} aria-label={muted?"Activer le micro":"Couper le micro"} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center active:scale-95">{muted?<MicOff size={20}/>:<Mic size={20}/>}</button>
{mode==="video"&&<button type="button" onClick={camera} aria-label={camOff?"Activer la caméra":"Couper la caméra"} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center active:scale-95">{camOff?<CameraOff size={20}/>:<Camera size={20}/>}</button>}
{mode==="voice"&&<button type="button" onClick={toggleRemoteSound} aria-label={remoteMuted?"Activer le son":"Couper le son"} className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center active:scale-95">{remoteMuted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>}
<button type="button" onClick={()=>void end()} aria-label="Raccrocher" className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-95"><PhoneOff size={25}/></button>
{mode==="video"&&<button type="button" onClick={()=>void switchCamera()} aria-label="Changer de caméra" className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center active:scale-95"><SwitchCamera size={20}/></button>}
</div></div>}