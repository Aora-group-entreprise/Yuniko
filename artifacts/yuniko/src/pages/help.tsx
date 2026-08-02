import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, HelpCircle, MessageCircle, Book, Shield, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

const FAQ = [
  { q: "How do I change my privacy settings?", a: "Go to Settings > Privacy to control who can see your posts, stories, and contact you." },
  { q: "How do I report a post or user?", a: "Tap the '...' menu on any post or profile and select Report." },
  { q: "Can I recover a deleted post?", a: "Unfortunately, deleted posts cannot be recovered. Make sure before you delete." },
  { q: "How do I enable two-factor authentication?", a: "Go to Settings > Security > Two-Factor Authentication." },
  { q: "How do I download my data?", a: "Go to Settings > Storage > Download My Data." },
];

const TOPICS = [
  { icon: Book, label: "Getting Started", color: "#FF3D9A" },
  { icon: Shield, label: "Privacy & Safety", color: "#B054FF" },
  { icon: MessageCircle, label: "Messages & Calls", color: "#FF6EB4" },
  { icon: AlertTriangle, label: "Reporting Issues", color: "#FF9A3C" },
];

export default function Help() {
  const [, setLocation] = useLocation();

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="help-header"
      >
        <button onClick={() => setLocation("/settings")} data-testid="btn-back-help">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("helpCenter")}</h1>
      </header>

      <div className="px-4 py-5">
        {/* Hero */}
        <div
          className="rounded-2xl p-5 mb-5 text-center"
          style={{ background: "rgba(255,0,110,0.08)", border: "1px solid rgba(255,0,110,0.2)" }}
        >
          <HelpCircle size={36} style={{ color: "#FF3D9A" }} className="mx-auto mb-2" />
          <h2 className="text-white font-bold text-lg mb-1">How can we help?</h2>
          <p className="text-white/50 text-sm">Find answers, contact support, and learn about Yuniko</p>
        </div>

        {/* Topics */}
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Browse Topics</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {TOPICS.map((topic) => (
            <button
              key={topic.label}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              data-testid={`help-topic-${topic.label}`}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${topic.color}22` }}>
                <topic.icon size={20} style={{ color: topic.color }} />
              </div>
              <span className="text-white/75 text-sm font-medium">{topic.label}</span>
            </button>
          ))}
        </div>

        {/* FAQ */}
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Frequently Asked</p>
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {FAQ.map((item, i) => (
            <details key={i} className="group" style={{ borderBottom: i < FAQ.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <summary className="flex items-center justify-between px-4 py-4 cursor-pointer list-none text-white/80 text-sm font-medium">
                {item.q}
                <ChevronRight size={16} className="text-white/30 flex-shrink-0 ml-2 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-4 pb-4">
                <p className="text-white/50 text-sm">{item.a}</p>
              </div>
            </details>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-5 p-4 rounded-2xl text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-white/70 text-sm mb-3">Still need help?</p>
          <button
            onClick={() => setLocation("/feedback")}
            className="px-6 py-2 rounded-full text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 2px 10px rgba(255,0,110,0.3)" }}
            data-testid="btn-contact-support"
          >
            Contact Support
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
