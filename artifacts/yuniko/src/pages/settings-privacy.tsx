import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight } from "lucide-react";
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

const OPTIONS = [t("everyone"), t("friendsOnly"), t("onlyMe")];

export default function PrivacySettings() {
  const [, setLocation] = useLocation();
  const [privateAccount, setPrivateAccount] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [messagePerms, setMessagePerms] = useState(t("everyone"));
  const [commentPerms, setCommentPerms] = useState(t("everyone"));
  const [storyPerms, setStoryPerms] = useState(t("friendsOnly"));

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button onClick={() => setLocation("/settings")} data-testid="btn-back-privacy">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("privacy")}</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Account privacy */}
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Account</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="flex-1">
                <p className="text-white/85 text-sm font-medium">{t("privateAccount")}</p>
                <p className="text-white/40 text-xs mt-0.5">Only approved followers can see your posts</p>
              </div>
              <Toggle value={privateAccount} onChange={setPrivateAccount} />
            </div>
            <div className="flex items-center gap-3 px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex-1">
                <p className="text-white/85 text-sm font-medium">{t("readReceipts")}</p>
                <p className="text-white/40 text-xs mt-0.5">Let others know when you've read their messages</p>
              </div>
              <Toggle value={readReceipts} onChange={setReadReceipts} />
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Permissions</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {[
              { label: t("messagePermissions"), value: messagePerms, onChange: setMessagePerms },
              { label: t("commentPermissions"), value: commentPerms, onChange: setCommentPerms },
              { label: t("storyPermissions"), value: storyPerms, onChange: setStoryPerms },
            ].map((perm, i) => (
              <div
                key={perm.label}
                className="flex items-center gap-3 px-4 py-4"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
              >
                <div className="flex-1">
                  <p className="text-white/85 text-sm font-medium">{perm.label}</p>
                </div>
                <select
                  value={perm.value}
                  onChange={(e) => perm.onChange(e.target.value)}
                  className="bg-transparent text-sm outline-none cursor-pointer"
                  style={{ color: "#FF3D9A" }}
                >
                  {OPTIONS.map((opt) => <option key={opt} value={opt} style={{ background: "#1E1433" }}>{opt}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Blocked users */}
        <button
          onClick={() => setLocation("/blocked-users")}
          className="flex items-center gap-3 px-4 py-4 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          data-testid="btn-blocked-users"
        >
          <span className="flex-1 text-white/85 text-sm">{t("blockedUsers")}</span>
          <ChevronRight size={16} className="text-white/30" />
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
