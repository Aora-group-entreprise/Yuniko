import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, HardDrive, Download, Trash2, Check } from "lucide-react";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

export default function StorageSettings() {
  const [, setLocation] = useLocation();
  const [cleared, setCleared] = useState(false);

  const handleClearCache = () => {
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button onClick={() => setLocation("/settings")} data-testid="btn-back-storage">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("storage")}</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Storage overview */}
        <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive size={16} style={{ color: "#FF3D9A" }} />
              <span className="text-white font-semibold text-sm">App Storage</span>
            </div>
            <span className="text-white/50 text-sm">248 MB / 2 GB</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div className="h-full rounded-full" style={{ width: "12.4%", background: "linear-gradient(90deg, #FF006E, #8B00FF)" }} />
          </div>
          <div className="flex justify-between mt-3 text-xs text-white/40">
            {[
              { label: "Cache", size: "124 MB", color: "#FF006E" },
              { label: "Media", size: "96 MB", color: "#B054FF" },
              { label: "Other", size: "28 MB", color: "#8B00FF" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                <span>{item.label} {item.size}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cache */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={handleClearCache}
            className="w-full flex items-center gap-3 px-4 py-4"
            data-testid="btn-clear-cache"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
              {cleared ? <Check size={16} className="text-green-400" /> : <Trash2 size={16} className="text-red-400" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-white/85 text-sm font-medium">{cleared ? "Cache Cleared!" : t("cacheManagement")}</p>
              <p className="text-white/40 text-xs mt-0.5">{cleared ? "Storage freed successfully" : "124 MB · Last cleared 3 days ago"}</p>
            </div>
          </button>
          <div className="flex items-center gap-3 px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
              <Download size={16} className="text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="text-white/85 text-sm font-medium">{t("downloadData")}</p>
              <p className="text-white/40 text-xs mt-0.5">Request a copy of all your Yuniko data</p>
            </div>
            <button
              className="px-3 py-1 rounded-full text-xs font-medium text-white"
              style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)" }}
              data-testid="btn-download-data"
            >
              Request
            </button>
          </div>
        </div>

        {/* Auto-delete */}
        <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Auto-Delete</p>
          {[
            { label: "Clear cache on exit", description: "Automatically clear cache when closing the app" },
            { label: "Delete watched stories", description: "Remove stories after you've viewed them" },
          ].map((item, i) => (
            <div key={item.label} className={`flex items-center gap-3 ${i > 0 ? "mt-3 pt-3 border-t border-white/[0.06]" : ""}`}>
              <div className="flex-1">
                <p className="text-white/80 text-sm">{item.label}</p>
                <p className="text-white/35 text-xs mt-0.5">{item.description}</p>
              </div>
              <div className="w-10 h-6 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
                <div className="w-5 h-5 rounded-full bg-white mt-0.5 ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
