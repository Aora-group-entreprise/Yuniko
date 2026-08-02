import { useLocation } from "wouter";
import { ArrowLeft, Archive } from "lucide-react";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

export default function ArchivedChats() {
  const [, setLocation] = useLocation();

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="archived-header"
      >
        <button onClick={() => setLocation("/messages")} data-testid="btn-back-archived">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("archivedChats")}</h1>
      </header>

      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Archive size={48} className="text-white/20" />
        <p className="text-white/40 text-sm">No archived chats</p>
        <p className="text-white/25 text-xs px-8 text-center">Swipe left on a conversation and tap Archive to move it here</p>
      </div>

      <BottomNav />
    </div>
  );
}
