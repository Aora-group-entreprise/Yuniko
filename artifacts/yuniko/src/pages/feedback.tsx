import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Star, Check } from "lucide-react";
import { t } from "@/lib/i18n";
import BottomNav from "@/components/BottomNav";

const CATEGORIES = ["Bug Report", "Feature Request", "Content Issue", "Account Problem", "Other"];

export default function Feedback() {
  const [, setLocation] = useLocation();
  const [category, setCategory] = useState("Bug Report");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setLocation("/settings"); }, 2000);
  };

  if (submitted) {
    return (
      <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 40px rgba(255,0,110,0.5)" }}
        >
          <Check size={36} className="text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-white font-bold text-xl">Thank you!</h2>
        <p className="text-white/50 text-sm">Your feedback has been received.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="feedback-header"
      >
        <button onClick={() => setLocation("/settings")} data-testid="btn-back-feedback">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("feedback")}</h1>
      </header>

      <div className="px-4 py-5 flex flex-col gap-5">
        {/* Rating */}
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Rate Your Experience</p>
          <div className="flex gap-2">
            {[1,2,3,4,5].map((star) => (
              <button key={star} onClick={() => setRating(star)} data-testid={`star-${star}`}>
                <Star
                  size={32}
                  className={star <= rating ? "text-yellow-400 fill-yellow-400" : "text-white/25"}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  background: category === cat ? "linear-gradient(135deg, #FF006E, #8B00FF)" : "rgba(255,255,255,0.07)",
                  color: category === cat ? "white" : "rgba(255,255,255,0.5)",
                }}
                data-testid={`category-${cat}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Your Message</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what's on your mind..."
            className="w-full px-4 py-3 rounded-2xl bg-transparent text-white/80 text-sm outline-none resize-none placeholder:text-white/30"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            rows={5}
            data-testid="input-feedback"
          />
        </div>

        <button
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm"
          style={{
            background: message.trim() ? "linear-gradient(135deg, #FF006E, #8B00FF)" : "rgba(255,255,255,0.08)",
            opacity: message.trim() ? 1 : 0.5,
            boxShadow: message.trim() ? "0 4px 20px rgba(255,0,110,0.4)" : "none",
          }}
          data-testid="btn-submit-feedback"
        >
          Send Feedback
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
