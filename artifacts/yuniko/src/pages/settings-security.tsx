import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, ChevronRight, Monitor, Clock, Smartphone } from "lucide-react";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-10 h-6 rounded-full transition-all duration-200"
      style={{ background: value ? "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)" : "rgba(255,255,255,0.15)" }}
    >
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200" style={{ left: value ? "calc(100% - 22px)" : "2px" }} />
    </button>
  );
}

const SESSIONS = [
  { id: "s1", device: "iPhone 15 Pro", location: "San Francisco, CA", time: "Active now", current: true },
  { id: "s2", device: "MacBook Pro", location: "San Francisco, CA", time: "2h ago", current: false },
];

export default function SecuritySettings() {
  const [, setLocation] = useLocation();
  const [twoFactor, setTwoFactor] = useState(false);

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button onClick={() => setLocation("/settings")} data-testid="btn-back-security">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("security")}</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Authentication</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-3 px-4 py-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.2)" }}
              >
                <Shield size={16} className="text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="text-white/85 text-sm font-medium">{t("twoFactor")}</p>
                <p className="text-white/40 text-xs mt-0.5">Add an extra layer of security</p>
              </div>
              <Toggle value={twoFactor} onChange={setTwoFactor} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">{t("activeSessions")}</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {SESSIONS.map((session, i) => (
              <div
                key={session.id}
                className="flex items-center gap-3 px-4 py-4"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <Smartphone size={18} className="text-white/60" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white/85 text-sm font-medium">{session.device}</p>
                    {session.current && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Current</span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs">{session.location} · {session.time}</p>
                </div>
                {!session.current && (
                  <button className="text-red-400 text-xs font-medium">Revoke</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          className="flex items-center gap-3 px-4 py-4 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Clock size={18} className="text-white/50" />
          <span className="flex-1 text-white/80 text-sm">{t("loginHistory")}</span>
          <ChevronRight size={16} className="text-white/30" />
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
