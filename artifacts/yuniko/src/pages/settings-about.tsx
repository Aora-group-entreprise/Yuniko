import { useLocation } from "wouter";
import { ArrowLeft, ExternalLink, Info, FileText, Shield } from "lucide-react";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

export default function About() {
  const [, setLocation] = useLocation();

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button onClick={() => setLocation("/settings")} data-testid="btn-back-about">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("about")}</h1>
      </header>

      {/* Logo */}
      <div className="flex flex-col items-center py-8 gap-2">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-1"
          style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 30px rgba(255,0,110,0.5)" }}
        >
          <span className="text-3xl font-black text-white">Y</span>
        </div>
        <span
          className="text-2xl font-black"
          style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
        >
          Yuniko
        </span>
        <p className="text-white/40 text-sm">Version 1.0.0</p>
        <p className="text-white/30 text-xs">Connect. Share. Inspire.</p>
      </div>

      <div className="px-4 flex flex-col gap-3">
        {[
          { icon: FileText, label: t("termsOfService"), href: "#" },
          { icon: Shield, label: t("privacyPolicy"), href: "#" },
          { icon: Info, label: "Open Source Licenses", href: "#" },
          { icon: ExternalLink, label: "yuniko.app", href: "#" },
        ].map((item) => (
          <button
            key={item.label}
            className="flex items-center gap-3 px-4 py-4 rounded-2xl text-left"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <item.icon size={18} style={{ color: "#FF3D9A" }} className="flex-shrink-0" />
            <span className="flex-1 text-white/80 text-sm">{item.label}</span>
            <ExternalLink size={14} className="text-white/25" />
          </button>
        ))}

        <p className="text-center text-white/25 text-xs pt-4">
          © 2026 Yuniko Inc. All rights reserved.
          {"\n"}Made with ❤️ for the world.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
