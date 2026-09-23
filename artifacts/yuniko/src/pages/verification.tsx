import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BadgeCheck, Loader2 } from "lucide-react";
import { apiJson } from "@/lib/api";

type VerificationStatus = "loading" | "none" | "pending" | "approved" | "rejected" | "error";

export default function Verification() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [message, setMessage] = useState("");

  const loadStatus = async () => {
    try {
      const data = await apiJson<{ request?: { status?: string } }>("/verification/status");
      const value = data.request?.status;
      setStatus(value === "pending" || value === "approved" || value === "rejected" ? value : "none");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const requestVerification = async () => {
    setMessage("");
    setStatus("loading");
    try {
      const data = await apiJson<{ status?: string }>("/verification/request", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setStatus(data.status === "pending" ? "pending" : "none");
      setMessage("Verification request submitted.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit verification request.");
    }
  };

  const statusText: Record<VerificationStatus, string> = {
    loading: "Loading verification status…",
    none: "Your account is not currently under verification review.",
    pending: "Your verification request is pending review.",
    approved: "Your account has been verified.",
    rejected: "Your previous verification request was rejected. You can submit a new request.",
    error: "Unable to load verification status.",
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background">
      <header className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3" style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => setLocation("/settings")} aria-label="Back">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">Verification</h1>
      </header>

      <main className="px-5 py-10 flex flex-col items-center text-center gap-5">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
          <BadgeCheck size={38} className="text-blue-400" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">Account Verification</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">{statusText[status]}</p>
        </div>

        {message && <p className="text-xs text-white/60">{message}</p>}

        {status === "loading" && <Loader2 size={22} className="animate-spin text-white/60" />}

        {(status === "none" || status === "rejected" || status === "error") && (
          <button
            onClick={() => void requestVerification()}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white"
            style={{ background: "#3B82F6" }}
          >
            Request Verification
          </button>
        )}
      </main>
    </div>
  );
}
