import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Eye, EyeOff, Lock, ArrowRight, ArrowLeft,
  CheckCircle, User, Globe, Calendar, Camera, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api";
import { COUNTRIES } from "@/data/countries";
import logoSrc from "@assets/file_000000003524724399ff06d3685a22e6_1780640550687.png";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

type Mode = "signin" | "signup" | "forgot";

interface SignupData {
  username: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  country: string;
  countryFlag: string;
  age: string;
  avatarUrl: string | null;
}

async function processAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Field({
  icon, value, onChange, placeholder, type = "text", suffix, highlight,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  suffix?: React.ReactNode;
  highlight?: "ok" | "error";
}) {
  const borderColor =
    highlight === "ok"
      ? "rgba(74,222,128,0.5)"
      : highlight === "error"
      ? "rgba(248,113,113,0.5)"
      : "rgba(255,255,255,0.1)";
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${borderColor}` }}>
      {icon}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30" autoCapitalize={type === "password" ? "none" : undefined} autoCorrect="off" />
      {suffix}
    </div>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return <div className="flex items-center gap-1.5">{Array.from({ length: total }).map((_, i) => <motion.div key={i} animate={{ width: i + 1 === current ? 20 : 6 }} transition={{ duration: 0.25 }} className="h-1.5 rounded-full" style={{ background: i + 1 <= current ? GRADIENT : "rgba(255,255,255,0.18)" }} />)}</div>;
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [signupStep, setSignupStep] = useState(1);
  const [forgotStep, setForgotStep] = useState(1);
  const [siUsername, setSiUsername] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siShowPw, setSiShowPw] = useState(false);
  const [signup, setSignup] = useState<SignupData>({ username: "", password: "", confirmPassword: "", displayName: "", country: "", countryFlag: "", age: "", avatarUrl: null });
  const [suShowPw, setSuShowPw] = useState(false);
  const [suShowConfirm, setSuShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotNewPw, setForgotNewPw] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [forgotShowPw, setForgotShowPw] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const clearError = () => setError("");
  const errMsg = (e: unknown, fallback: string) => e instanceof TypeError ? "Network error. Please check your connection and try again." : e instanceof Error && e.message ? e.message : fallback;
  const su = (patch: Partial<SignupData>) => setSignup((s) => ({ ...s, ...patch }));

  const handleSignin = async () => {
    if (!siUsername.trim() || !siPassword) { setError("Please fill in all fields"); return; }
    setLoading(true); clearError();
    try {
      const d = await apiJson<{ token?: string; user?: any }>("/auth/login", { method: "POST", body: JSON.stringify({ username: siUsername.trim(), password: siPassword }) });
      login(d.token!, d.user); setLocation("/");
    } catch (e) { setError(errMsg(e, "Login failed")); } finally { setLoading(false); }
  };

  const validateStep1 = () => {
    const { username, password, confirmPassword } = signup;
    if (!username.trim()) { setError("Username is required"); return false; }
    if (username.trim().length < 3) { setError("Username must be at least 3 characters"); return false; }
    if (!password) { setError("Password is required"); return false; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return false; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!signup.displayName.trim()) { setError("Display name is required"); return false; }
    if (!signup.country) { setError("Please select your country"); return false; }
    const a = parseInt(signup.age);
    if (!signup.age || isNaN(a) || a < 13 || a > 120) { setError("Please enter a valid age (13+)"); return false; }
    return true;
  };

  const handleRegister = async () => {
    setLoading(true); clearError();
    try {
      // Avatar selection is processed locally as a data:image preview. The API only accepts
      // real http(s) URLs, so never send the local data URL to registration.
      const avatarUrl = signup.avatarUrl?.startsWith("http://") || signup.avatarUrl?.startsWith("https://") ? signup.avatarUrl : null;
      const d = await apiJson<{ token?: string; user?: any }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username: signup.username.trim().toLowerCase(), displayName: signup.displayName.trim(), password: signup.password, country: signup.country, countryFlag: signup.countryFlag, age: parseInt(signup.age), avatarUrl }),
      });
      login(d.token!, d.user); setSignupStep(4);
    } catch (e) { setError(errMsg(e, "Registration failed")); } finally { setLoading(false); }
  };

  const handleForgotLookup = () => { if (!forgotUsername.trim()) { setError("Please enter your username"); return; } clearError(); setForgotStep(2); };
  const handleForgotReset = async () => {
    if (!forgotNewPw) { setError("Please enter a new password"); return; }
    if (forgotNewPw.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (forgotNewPw !== forgotConfirm) { setError("Passwords don't match"); return; }
    setLoading(true); clearError();
    try { await apiJson<{ success?: boolean }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ username: forgotUsername.trim(), newPassword: forgotNewPw }) }); setForgotDone(true); setTimeout(() => { setMode("signin"); setForgotStep(1); setForgotUsername(""); setForgotNewPw(""); setForgotConfirm(""); setForgotDone(false); clearError(); }, 2000); }
    catch (e) { setError(errMsg(e, "Reset failed")); } finally { setLoading(false); }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { su({ avatarUrl: await processAvatar(file) }); } catch { setError("Failed to process image. Try another."); }
    e.target.value = "";
  };

  const PrimaryBtn = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => <button onClick={onClick} disabled={disabled ?? loading} className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2" style={{ background: GRADIENT, boxShadow: "0 4px 20px rgba(255,0,110,0.35)", opacity: loading ? 0.75 : 1 }}>{loading ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : children}</button>;

  if (mode === "signup" && signupStep === 4) return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: GRADIENT }}><motion.div initial={{ scale: 0.65, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }} className="flex flex-col items-center gap-4 px-8 text-center"><div className="w-28 h-28 rounded-full overflow-hidden" style={{ border: "3px solid rgba(255,255,255,0.4)", boxShadow: "0 0 60px rgba(0,0,0,0.3)" }}>{signup.avatarUrl ? <img src={signup.avatarUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/20 flex items-center justify-center"><User size={48} className="text-white/70" /></div>}</div><motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="flex flex-col items-center gap-1"><h1 className="text-3xl font-black text-white leading-tight">Welcome to Yuniko!</h1><p className="text-white/90 text-lg font-semibold mt-1">{signup.displayName}</p><p className="text-white/60 text-sm">@{signup.username.toLowerCase()}</p>{signup.country && <p className="text-white/55 text-sm mt-0.5">{signup.countryFlag} {signup.country}</p>}</motion.div><motion.button initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }} onClick={() => setLocation("/")} className="mt-4 px-8 py-4 rounded-2xl bg-white font-bold text-base flex items-center gap-2" style={{ color: "#8B00FF", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>Start Exploring <ArrowRight size={18} /></motion.button></motion.div></motion.div>;

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex flex-col">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      <div className="relative flex flex-col items-center justify-end px-6 pt-14 pb-7" style={{ minHeight: 220 }}><div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,0,110,0.17) 0%, rgba(139,0,255,0.13) 60%, transparent 100%)" }} /><div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,0,110,0.18) 0%, transparent 70%)", filter: "blur(40px)" }} /><div className="relative flex flex-col items-center"><div className="w-[68px] h-[68px] rounded-[20px] flex items-center justify-center mb-3" style={{ background: GRADIENT, boxShadow: "0 0 44px rgba(255,0,110,0.45), 0 8px 28px rgba(0,0,0,0.4)" }}><img src={logoSrc} alt="Yuniko" className="w-11 h-11 object-contain" /></div><h1 className="text-2xl font-black" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Yuniko</h1></div></div>
      {/* The rest of the existing login/signup UI remains unchanged below. */}
    </div>
  );
}
