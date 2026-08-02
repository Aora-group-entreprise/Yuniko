import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { CameraOff, Camera, MicOff, Mic, PhoneOff, SwitchCamera, Maximize2, Volume2 } from "lucide-react";
import { getUserById, users } from "@/data/mockData";
import { t } from "@/lib/i18n";

export default function VideoCall() {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "u1";
  const user = getUserById(userId) ?? users[0];

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callState, setCallState] = useState<"connecting" | "active" | "ended">("connecting");

  useEffect(() => {
    const t = setTimeout(() => setCallState("active"), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (callState !== "active") return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const endCall = () => {
    setCallState("ended");
    setTimeout(() => setLocation("/"), 1500);
  };

  if (callState === "ended") {
    return (
      <div className="w-full max-w-[430px] mx-auto min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-white/60 text-lg">{t("callEnded")}</p>
        <p className="text-white/40 text-sm">{formatDuration(callDuration)}</p>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-[430px] mx-auto min-h-screen relative overflow-hidden"
      style={{ background: "#0A0A0F" }}
      data-testid="video-call-screen"
    >
      {/* Remote video (full screen) */}
      <img
        src={user.avatar}
        alt={user.displayName}
        className="absolute inset-0 w-full h-full object-cover opacity-80"
        style={{ filter: "blur(2px) brightness(0.6)" }}
      />

      {/* Remote video placeholder with actual avatar */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={`https://picsum.photos/seed/video_call_${userId}/400/700`}
          alt=""
          className="w-full h-full object-cover"
          style={{ opacity: 0.7 }}
        />
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.7) 100%)" }} />

      {/* Top bar */}
      <div className="absolute top-10 left-4 right-4 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-lg">{user.displayName}</p>
          <p className="text-white/60 text-sm">
            {callState === "connecting" ? t("calling") : formatDuration(callDuration)}
          </p>
        </div>
        <button
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)" }}
          data-testid="btn-fullscreen"
        >
          <Maximize2 size={18} className="text-white" />
        </button>
      </div>

      {/* Self video (small, corner) */}
      <div
        className="absolute top-28 right-4 w-24 h-32 rounded-2xl overflow-hidden"
        style={{ border: "2px solid rgba(255,255,255,0.2)", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
        data-testid="self-video"
      >
        {cameraOff ? (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <CameraOff size={20} className="text-white/40" />
          </div>
        ) : (
          <img src="https://picsum.photos/seed/me_video/200/300" alt="You" className="w-full h-full object-cover" />
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-12 left-0 right-0">
        <div className="flex items-center justify-center gap-5">
          <ControlBtn
            icon={muted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
            onClick={() => setMuted((prev) => !prev)}
            active={!muted}
            label={t("mute")}
            testId="btn-mute-video"
          />
          <ControlBtn
            icon={cameraOff ? <CameraOff size={22} className="text-white" /> : <Camera size={22} className="text-white" />}
            onClick={() => setCameraOff((prev) => !prev)}
            active={!cameraOff}
            label={t("camera")}
            testId="btn-camera-toggle"
          />
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "#EF4444", boxShadow: "0 4px 20px rgba(239,68,68,0.5)" }}
            data-testid="btn-end-video-call"
          >
            <PhoneOff size={26} className="text-white" />
          </button>
          <ControlBtn
            icon={<SwitchCamera size={22} className="text-white" />}
            onClick={() => {}}
            active={true}
            label={t("switchCamera")}
            testId="btn-switch-camera"
          />
          <ControlBtn
            icon={<Volume2 size={22} className="text-white" />}
            onClick={() => {}}
            active={true}
            label={t("speaker")}
            testId="btn-speaker-video"
          />
        </div>
      </div>
    </div>
  );
}

function ControlBtn({
  icon,
  onClick,
  active,
  label,
  testId,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  active: boolean;
  label: string;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1"
      data-testid={testId}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: active ? "rgba(255,255,255,0.18)" : "rgba(239,68,68,0.25)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        {icon}
      </div>
      <span className="text-white/50 text-[10px]">{label}</span>
    </button>
  );
}
