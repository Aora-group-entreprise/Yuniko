import { useLocation } from "wouter";
import { ArrowLeft, PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone, Video } from "lucide-react";
import { getUserById } from "@/data/mockData";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

const CALL_LOG = [
  { id: "cl1", userId: "u1", type: "incoming", callType: "video", duration: "4:32", timestamp: "2h ago", missed: false },
  { id: "cl2", userId: "u2", type: "outgoing", callType: "voice", duration: "12:04", timestamp: "5h ago", missed: false },
  { id: "cl3", userId: "u3", type: "missed", callType: "video", duration: "", timestamp: "Yesterday", missed: true },
  { id: "cl4", userId: "u5", type: "incoming", callType: "voice", duration: "2:18", timestamp: "2d ago", missed: false },
  { id: "cl5", userId: "u8", type: "outgoing", callType: "video", duration: "38:22", timestamp: "3d ago", missed: false },
];

export default function CallHistory() {
  const [, setLocation] = useLocation();

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="call-history-header"
      >
        <button onClick={() => setLocation("/messages")} data-testid="btn-back-call-history">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("callHistory")}</h1>
      </header>

      <div data-testid="call-log">
        {CALL_LOG.map((call) => {
          const user = getUserById(call.userId);
          if (!user) return null;
          return (
            <button
              key={call.id}
              onClick={() => setLocation(call.callType === "video" ? "/video-call" : "/voice-call")}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              data-testid={`call-${call.id}`}
            >
              <img src={user.avatar} alt={user.displayName} className="w-11 h-11 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{user.displayName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {call.missed ? (
                    <PhoneMissed size={13} className="text-red-400" />
                  ) : call.type === "incoming" ? (
                    <PhoneIncoming size={13} className="text-green-400" />
                  ) : (
                    <PhoneOutgoing size={13} className="text-blue-400" />
                  )}
                  <span className={`text-xs ${call.missed ? "text-red-400" : "text-white/50"}`}>
                    {call.missed ? "Missed" : call.type} · {call.duration || "—"}
                  </span>
                  <span className="text-white/30 text-xs">· {call.timestamp}</span>
                </div>
              </div>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,0,110,0.12)", border: "1px solid rgba(255,0,110,0.25)" }}
              >
                {call.callType === "video" ? (
                  <Video size={16} style={{ color: "#FF3D9A" }} />
                ) : (
                  <Phone size={16} style={{ color: "#FF3D9A" }} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
