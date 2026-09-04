import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { apiJson } from "@/lib/api";

type Call = { id: string; callerId: number; targetUserId: number; status: string };
type PublicUser = { id: number; username: string; displayName: string; avatarUrl: string | null };

type RouteParams = { userId?: string };

type Signal = { id: number; senderId: number; type: string; payload: string };

export default function VideoCall() {
  const [, setLocation] = useLocation();
  const params = useParams() as RouteParams;
  const targetId = Number(params.userId ?? 0);
  const search = new URLSearchParams(window.location.search);
  const incoming = search.get("incoming") === "1";
  const existingCallId = search.get("callId");

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const callRef = useRef<Call | null>(
    existingCallId
      ? { id: existingCallId, callerId: targetId, targetUserId: 0, status: "connecting" }
      : null,
  );
  const cursor = useRef(0);
  const [state, setState] = useState(incoming ? "connecting" : "starting");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [participant, setParticipant] = useState<PublicUser | null>(null);

  const uid = () => Number(localStorage.getItem("yuniko_user_id") || 0);

  const signal = async (type: string, value: unknown) => {
    if (!callRef.current) return;
    await apiJson(`/calls/${callRef.current.id}/signal`, {
      method: "POST",
      body: JSON.stringify({ type, signal: value }),
    }).catch(() => undefined);
  };

  const flushIce = async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    const pending = pendingIceRef.current.splice(0);
    for (const candidate of pending) {
      await pc.addIceCandidate(candidate).catch(() => undefined);
    }
  };

  useEffect(() => {
    let dead = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (dead) return;
        streamRef.current = stream;

        if (localRef.current) {
          localRef.current.srcObject = stream;
          await localRef.current.play().catch(() => undefined);
        }

        const created = incoming
          ? null
          : await apiJson<{ call: Call }>("/calls/session", {
              method: "POST",
              body: JSON.stringify({ targetUserId: targetId, kind: "video" }),
            });

        if (created) callRef.current = created.call;

        const participantId = incoming
          ? callRef.current?.callerId ?? targetId
          : callRef.current?.targetUserId ?? targetId;

        if (participantId) {
          const response = await apiJson<{ user: PublicUser }>(`/users/${participantId}`).catch(
            () => null,
          );
          if (response?.user && !dead) setParticipant(response.user);
        }

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (remoteRef.current) {
            remoteRef.current.srcObject = event.streams[0];
            remoteRef.current.play().catch(() => undefined);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) void signal("candidate", event.candidate);
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            setState("connected");
            if (callRef.current) {
              void apiJson(`/calls/${callRef.current.id}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "active" }),
              }).catch(() => undefined);
            }
          } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
            setState("ended");
          }
        };

        if (!incoming && callRef.current?.callerId === uid()) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await signal("offer", offer);
        } else if (!incoming) {
          setState("waiting");
        }

        await flushIce();
      } catch {
        if (!dead) setState("permission-denied");
      }
    };

    void start();
    return () => {
      dead = true;
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [targetId, incoming]);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let delay = 300;

    const poll = async () => {
      const call = callRef.current;
      if (!call || stopped) return;

      try {
        const data = await apiJson<{ signals: Signal[] }>(
          `/calls/${call.id}/signals?after=${cursor.current}`,
        );

        for (const item of data.signals) {
          cursor.current = Math.max(cursor.current, item.id);
          if (item.senderId === uid()) continue;

          const pc = pcRef.current;
          if (!pc) continue;
          const value = JSON.parse(item.payload) as RTCSessionDescriptionInit | RTCIceCandidateInit;

          if (item.type === "offer") {
            await pc.setRemoteDescription(value as RTCSessionDescriptionInit);
            await flushIce();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await signal("answer", answer);
          } else if (item.type === "answer") {
            await pc.setRemoteDescription(value as RTCSessionDescriptionInit);
            await flushIce();
          } else if (item.type === "candidate") {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(value as RTCIceCandidateInit).catch(() => undefined);
            } else {
              pendingIceRef.current.push(value as RTCIceCandidateInit);
            }
          }
        }

        delay = data.signals.length ? 300 : Math.min(delay * 1.5, 1500);
      } catch {
        delay = Math.min(delay * 1.5, 2000);
      }

      if (!stopped) timer = window.setTimeout(poll, delay);
    };

    void poll();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (state !== "connected") return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };

  const toggleCamera = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamera(track.enabled);
  };

  const end = async () => {
    if (callRef.current) {
      await apiJson(`/calls/${callRef.current.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ended" }),
      }).catch(() => undefined);
    }
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setLocation("/");
  };

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 flex items-center justify-center text-white/30 pointer-events-none">
        {state === "permission-denied"
          ? "Camera/microphone permission denied"
          : state === "waiting"
            ? "Waiting for the other user to join…"
            : state === "ended"
              ? "Call ended"
              : state === "starting"
                ? "Starting camera…"
                : ""}
      </div>
      <video ref={localRef} muted playsInline className="absolute right-4 top-12 z-10 w-28 h-40 rounded-2xl object-cover border border-white/20" />
      <div className="absolute top-5 left-4 z-10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10">
          {participant?.avatarUrl && <img src={participant.avatarUrl} alt="" className="w-full h-full object-cover" />}
        </div>
        <div>
          <p className="font-semibold">{participant?.displayName ?? "Video call"}</p>
          <p className="text-white/50 text-xs">
            @{participant?.username ?? "unknown"} · {state === "connected" ? time : "not connected"}
          </p>
        </div>
      </div>
      <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center gap-4">
        <button onClick={toggleMic} className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
          {muted ? <MicOff /> : <Mic />}
        </button>
        <button onClick={toggleCamera} className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
          {camera ? <Video /> : <VideoOff />}
        </button>
        <button onClick={end} className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
          <PhoneOff />
        </button>
      </div>
    </div>
  );
}
