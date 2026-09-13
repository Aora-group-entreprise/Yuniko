import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n";

export default function DeleteAccount() {
  const [, setLocation] = useLocation();
  const [confirmed, setConfirmed] = useState(false);
  const [input, setInput] = useState("");

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button onClick={() => setLocation("/settings")} data-testid="btn-back-delete">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("deleteAccount")}</h1>
      </header>

      <div className="px-4 py-8 flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.3)" }}>
          <AlertTriangle size={36} className="text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="text-white font-bold text-xl mb-2">Delete Account</h2>
          <p className="text-white/50 text-sm leading-relaxed">This action is permanent and cannot be undone. All your posts, stories, messages, and followers will be permanently deleted.</p>
        </div>

        <div className="w-full p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <p className="text-red-400/80 text-sm text-center">Type <span className="font-bold text-red-400">DELETE</span> to confirm</p>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="DELETE"
            className="w-full mt-3 px-4 py-2.5 rounded-xl text-center font-mono font-bold text-red-400 bg-transparent outline-none placeholder:text-red-400/30 tracking-widest"
            style={{ border: "1px solid rgba(239,68,68,0.3)" }}
            data-testid="input-delete-confirm"
          />
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            disabled={input !== "DELETE"}
            onClick={() => setLocation("/")}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold"
            style={{
              background: input === "DELETE" ? "#EF4444" : "rgba(239,68,68,0.2)",
              color: input === "DELETE" ? "white" : "rgba(239,68,68,0.4)",
            }}
            data-testid="btn-confirm-delete"
          >
            Permanently Delete Account
          </button>
          <button
            onClick={() => setLocation("/settings")}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white/70"
            style={{ background: "rgba(255,255,255,0.07)" }}
            data-testid="btn-cancel-delete"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
