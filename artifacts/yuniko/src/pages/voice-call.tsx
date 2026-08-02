import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, BadgeCheck } from "lucide-react";
import { getUserById, users } from "@/data/mockData";
import { t } from "@/lib/i18n";

export default function VoiceCall() {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "u1";
  const user = getUserById(userId) ?? users[0];

  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callState, setCallState] = useState<"connecting" | "active" | "ended">("connecting");

  useEffect(() => {
    const timer = setTimeout(() => setCallState("active"), 2000);
    return () => clearTimeout(timer);
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
      <div
        className="w-full max-w-[430px] mx-auto min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "linear-gradient(180deg, #1E1433 0%, #0D0B14 100%)" }}
      >
        <p className="text-white/60 text-lg">{t("callEnded")}</p>
        <p className="text-white/40 text-sm">{formatDuration(callDuration)}</p>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-[430px] mx-auto min-h-screen relative flex flex-col items-center"
      style={{ background: "linear-gradient(180deg, #1E1433 0%, #0D0B14 100%)" }}
      data-testid="voice-call-screen"
    >
      {/* Background blur */}
      <img
        src={user.avatar}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-10"
        style={{ filter: "blur(40px)" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center pt-24 flex-1 w-full">
        {/* Avatar */}
        <div
          className="w-28 h-28 rounded-full p-[3px] mb-5"
          style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 40px rgba(255,0,110,0.5)" }}
        >
          <img
            src={user.avatar}
            alt={user.displayName}
            className="w-full h-full rounded-full object-cover"
            style={{ border: "3px solid #0D0B14" }}
          />
        </div>

        {/* Name */}
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-white font-bold text-2xl">{user.displayName}</h2>
          {user.verified && <BadgeCheck size={20} className="text-blue-400 fill-blue-400" />}
        </div>

        {/* Status */}
        <p
          className="text-sm font-medium mb-1"
          style={{ color: callState === "active" ? "#FF3D9A" : "rgba(255,255,255,0.5)" }}
        >
          {callState === "connecting" ? t("calling") : formatDuration(callDuration)}
        </p>

        {callState === "active" && (
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-0.5 rounded-full"
                style={{
                  background: "rgba(255,61,154,0.6)",
                  height: 4 + Math.random() * 16,
                  animation: `pulse ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-6">
          <div className="flex items-center gap-8">
            <CallBtn
              icon={muted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
              onClick={() => setMuted((prev) => !prev)}
              active={!muted}
              label={t("mute")}
              testId="btn-mute-voice"
            />
            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#EF4444", boxShadow: "0 4px 24px rgba(239,68,68,0.5)" }}
              data-testid="btn-end-voice-call"
            >
              <PhoneOff size={26} className="text-white" />
            </button>
            <CallBtn
              icon={speakerOn ? <Volume2 size={22} className="text-white" /> : <VolumeX size={22} className="text-white" />}
              onClick={() => setSpeakerOn((prev) => !prev)}
              active={speakerOn}
              label={t("speaker")}
              testId="btn-speaker-voice"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CallBtn({
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
    <button onClick={onClick} className="flex flex-col items-center gap-2" data-testid={testId}>
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: active ? "rgba(255,255,255,0.15)" : "rgba(255,0,110,0.2)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {icon}
      </div>
      <span className="text-white/50 text-xs">{label}</span>
    </button>
  );
}
