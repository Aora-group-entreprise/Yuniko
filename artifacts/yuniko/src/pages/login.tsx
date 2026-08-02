import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Eye, EyeOff, Lock, ArrowRight, ArrowLeft,
  CheckCircle, XCircle, Loader, User, Globe, Calendar, Camera, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { COUNTRIES } from "@/data/countries";
import logoSrc from "@assets/file_000000003524724399ff06d3685a22e6_1780640550687.png";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

type Mode = "signin" | "signup" | "forgot";
type UsernameStatus = "idle" | "checking" | "available" | "taken";

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

// ── Reusable input field ──────────────────────────────────────────────────────
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
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors"
      style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${borderColor}` }}
    >
      {icon}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30"
        autoCapitalize={type === "password" ? "none" : undefined}
        autoCorrect="off"
      />
      {suffix}
    </div>
  );
}

// ── Step dots ─────────────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ width: i + 1 === current ? 20 : 6 }}
          transition={{ duration: 0.25 }}
          className="h-1.5 rounded-full"
          style={{
            background:
              i + 1 <= current
                ? GRADIENT
                : "rgba(255,255,255,0.18)",
          }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [signupStep, setSignupStep] = useState(1);
  const [forgotStep, setForgotStep] = useState(1);

  // ── Signin
  const [siUsername, setSiUsername] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siShowPw, setSiShowPw] = useState(false);

  // ── Signup
  const [signup, setSignup] = useState<SignupData>({
    username: "", password: "", confirmPassword: "",
    displayName: "", country: "", countryFlag: "", age: "", avatarUrl: null,
  });
  const [suShowPw, setSuShowPw] = useState(false);
  const [suShowConfirm, setSuShowConfirm] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Forgot
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotNewPw, setForgotNewPw] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [forgotShowPw, setForgotShowPw] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);

  // ── Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clearError = () => setError("");
  const su = (patch: Partial<SignupData>) => setSignup((s) => ({ ...s, ...patch }));

  // Username availability — debounced 500ms
  useEffect(() => {
    if (mode !== "signup" || signupStep !== 1) return;
    const u = signup.username.trim();
    if (u.length < 3) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/auth/check-username/${encodeURIComponent(u)}`);
        const d = await r.json() as { available: boolean };
        setUsernameStatus(d.available ? "available" : "taken");
      } catch { setUsernameStatus("idle"); }
    }, 500);
    return () => clearTimeout(t);
  }, [signup.username, mode, signupStep]);

  // ── Signin submit
  const handleSignin = async () => {
    if (!siUsername.trim() || !siPassword) { setError("Please fill in all fields"); return; }
    setLoading(true); clearError();
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: siUsername.trim(), password: siPassword }),
      });
      const d = await r.json() as { token?: string; user?: any; error?: string };
      if (!r.ok) { setError(d.error ?? "Login failed"); return; }
      login(d.token!, d.user);
      setLocation("/");
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  // ── Signup step 1 validate
  const validateStep1 = () => {
    const { username, password, confirmPassword } = signup;
    if (!username.trim()) { setError("Username is required"); return false; }
    if (username.trim().length < 3) { setError("Username must be at least 3 characters"); return false; }
    if (usernameStatus === "taken") { setError("That username is already taken"); return false; }
    if (usernameStatus === "checking") { setError("Still checking username…"); return false; }
    if (!password) { setError("Password is required"); return false; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return false; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!signup.displayName.trim()) { setError("Display name is required"); return false; }
    if (!signup.country) { setError("Please select your country"); return false; }
    const a = parseInt(signup.age);
    if (!signup.age || isNaN(a) || a < 13 || a > 120) {
      setError("Please enter a valid age (13+)"); return false;
    }
    return true;
  };

  // ── Signup final submit
  const handleRegister = async () => {
    setLoading(true); clearError();
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: signup.username.trim().toLowerCase(),
          displayName: signup.displayName.trim(),
          password: signup.password,
          country: signup.country,
          countryFlag: signup.countryFlag,
          age: parseInt(signup.age),
          avatarUrl: signup.avatarUrl,
        }),
      });
      const d = await r.json() as { token?: string; user?: any; error?: string };
      if (!r.ok) { setError(d.error ?? "Registration failed"); return; }
      login(d.token!, d.user);
      setSignupStep(4);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  // ── Forgot step 1
  const handleForgotLookup = async () => {
    if (!forgotUsername.trim()) { setError("Please enter your username"); return; }
    setLoading(true); clearError();
    try {
      const r = await fetch(`/api/auth/check-username/${encodeURIComponent(forgotUsername.trim())}`);
      const d = await r.json() as { available: boolean };
      if (d.available) { setError("No account found with that username"); return; }
      setForgotStep(2);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  // ── Forgot step 2
  const handleForgotReset = async () => {
    if (!forgotNewPw) { setError("Please enter a new password"); return; }
    if (forgotNewPw.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (forgotNewPw !== forgotConfirm) { setError("Passwords don't match"); return; }
    setLoading(true); clearError();
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername.trim(), newPassword: forgotNewPw }),
      });
      const d = await r.json() as { success?: boolean; error?: string };
      if (!r.ok) { setError(d.error ?? "Reset failed"); return; }
      setForgotDone(true);
      setTimeout(() => {
        setMode("signin"); setForgotStep(1);
        setForgotUsername(""); setForgotNewPw(""); setForgotConfirm(""); setForgotDone(false);
        clearError();
      }, 2000);
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { su({ avatarUrl: await processAvatar(file) }); }
    catch { setError("Failed to process image. Try another."); }
    e.target.value = "";
  };

  const PrimaryBtn = ({
    onClick, disabled, children,
  }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      disabled={disabled ?? loading}
      className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2"
      style={{ background: GRADIENT, boxShadow: "0 4px 20px rgba(255,0,110,0.35)", opacity: loading ? 0.75 : 1 }}
    >
      {loading
        ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        : children}
    </button>
  );

  // ── Welcome screen (signup step 4) ──────────────────────────────────────────
  if (mode === "signup" && signupStep === 4) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center"
        style={{ background: GRADIENT }}
      >
        <motion.div
          initial={{ scale: 0.65, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex flex-col items-center gap-4 px-8 text-center"
        >
          {/* Avatar */}
          <div
            className="w-28 h-28 rounded-full overflow-hidden"
            style={{ border: "3px solid rgba(255,255,255,0.4)", boxShadow: "0 0 60px rgba(0,0,0,0.3)" }}
          >
            {signup.avatarUrl ? (
              <img src={signup.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center">
                <User size={48} className="text-white/70" />
              </div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="flex flex-col items-center gap-1"
          >
            <h1 className="text-3xl font-black text-white leading-tight">Welcome to Yuniko!</h1>
            <p className="text-white/90 text-lg font-semibold mt-1">{signup.displayName}</p>
            <p className="text-white/60 text-sm">@{signup.username.toLowerCase()}</p>
            {signup.country && (
              <p className="text-white/55 text-sm mt-0.5">{signup.countryFlag} {signup.country}</p>
            )}
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            onClick={() => setLocation("/")}
            className="mt-4 px-8 py-4 rounded-2xl bg-white font-bold text-base flex items-center gap-2"
            style={{ color: "#8B00FF", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}
          >
            Start Exploring <ArrowRight size={18} />
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  // ── Hero ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex flex-col">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

      <div
        className="relative flex flex-col items-center justify-end px-6 pt-14 pb-7"
        style={{ minHeight: 220 }}
      >
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,0,110,0.17) 0%, rgba(139,0,255,0.13) 60%, transparent 100%)" }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,0,110,0.18) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="relative flex flex-col items-center">
          <div className="w-[68px] h-[68px] rounded-[20px] flex items-center justify-center mb-3" style={{ background: GRADIENT, boxShadow: "0 0 44px rgba(255,0,110,0.45), 0 8px 28px rgba(0,0,0,0.4)" }}>
            <img src={logoSrc} alt="Yuniko" className="w-11 h-11 object-contain" />
          </div>
          <h1 className="text-2xl font-black" style={{ background: GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Yuniko</h1>
        </div>
      </div>

      {/* Form area */}
      <div className="flex-1 px-6 pb-10">
        <AnimatePresence mode="wait" initial={false}>

          {/* ══ SIGN IN ══════════════════════════════════════════════════════════ */}
          {mode === "signin" && (
            <motion.div key="signin" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.18 }}>
              {/* Toggle */}
              <div className="flex p-1 rounded-2xl mb-6" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <button className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: GRADIENT, color: "white", boxShadow: "0 2px 10px rgba(255,0,110,0.3)" }}>Sign In</button>
                <button onClick={() => { setMode("signup"); setSignupStep(1); clearError(); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Sign Up</button>
              </div>

              <div className="flex flex-col gap-3 mb-4">
                <Field icon={<User size={18} className="text-white/40 flex-shrink-0" />} value={siUsername} onChange={(v) => { setSiUsername(v); clearError(); }} placeholder="Username" />
                <Field
                  icon={<Lock size={18} className="text-white/40 flex-shrink-0" />}
                  value={siPassword} onChange={(v) => { setSiPassword(v); clearError(); }}
                  placeholder="Password" type={siShowPw ? "text" : "password"}
                  suffix={<button type="button" onClick={() => setSiShowPw(p => !p)}>{siShowPw ? <EyeOff size={16} className="text-white/40" /> : <Eye size={16} className="text-white/40" />}</button>}
                />
              </div>

              <div className="text-right mb-5">
                <button onClick={() => { setMode("forgot"); setForgotStep(1); clearError(); }} className="text-sm font-medium" style={{ color: "#FF3D9A" }}>Forgot Password?</button>
              </div>

              {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}
              <PrimaryBtn onClick={handleSignin}><span>Sign In</span><ArrowRight size={16} /></PrimaryBtn>

              <p className="text-center text-white/40 text-sm mt-5">
                Don't have an account?{" "}
                <button onClick={() => { setMode("signup"); setSignupStep(1); clearError(); }} className="font-semibold" style={{ color: "#FF3D9A" }}>Sign Up</button>
              </p>
            </motion.div>
          )}

          {/* ══ SIGNUP — Step 1: username + password ════════════════════════════ */}
          {mode === "signup" && signupStep === 1 && (
            <motion.div key="su1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.18 }}>
              <div className="flex items-center justify-between mb-5">
                <button type="button" onClick={() => { setMode("signin"); clearError(); }}><ArrowLeft size={20} className="text-white/60" /></button>
                <StepDots current={1} total={3} />
                <div className="w-6" />
              </div>

              <h2 className="text-xl font-bold text-white mb-1">Create account</h2>
              <p className="text-white/40 text-sm mb-5">Choose a unique username</p>

              <div className="flex flex-col gap-3 mb-5">
                {/* Username */}
                <div>
                  <div
                    className="flex items-center gap-2 px-4 py-3.5 rounded-2xl transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${usernameStatus === "available" ? "rgba(74,222,128,0.5)" : usernameStatus === "taken" ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    <span className="text-white/40 text-sm flex-shrink-0 select-none">@</span>
                    <input
                      value={signup.username}
                      onChange={(e) => { su({ username: e.target.value.replace(/[^a-zA-Z0-9._]/g, "") }); clearError(); }}
                      placeholder="username"
                      autoCapitalize="none" autoCorrect="off"
                      className="flex-1 bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30"
                    />
                    {usernameStatus === "checking" && <Loader size={15} className="text-white/40 animate-spin flex-shrink-0" />}
                    {usernameStatus === "available" && <CheckCircle size={15} className="text-green-400 flex-shrink-0" />}
                    {usernameStatus === "taken" && <XCircle size={15} className="text-red-400 flex-shrink-0" />}
                  </div>
                  {usernameStatus === "available" && <p className="text-green-400 text-xs mt-1.5 ml-1">Username available ✓</p>}
                  {usernameStatus === "taken" && <p className="text-red-400 text-xs mt-1.5 ml-1">Username already taken</p>}
                </div>

                <Field
                  icon={<Lock size={18} className="text-white/40 flex-shrink-0" />}
                  value={signup.password} onChange={(v) => { su({ password: v }); clearError(); }}
                  placeholder="Password (min 6 characters)" type={suShowPw ? "text" : "password"}
                  suffix={<button type="button" onClick={() => setSuShowPw(p => !p)}>{suShowPw ? <EyeOff size={16} className="text-white/40" /> : <Eye size={16} className="text-white/40" />}</button>}
                />
                <Field
                  icon={<Lock size={18} className="text-white/40 flex-shrink-0" />}
                  value={signup.confirmPassword} onChange={(v) => { su({ confirmPassword: v }); clearError(); }}
                  placeholder="Confirm password" type={suShowConfirm ? "text" : "password"}
                  highlight={signup.confirmPassword && signup.confirmPassword === signup.password ? "ok" : signup.confirmPassword && signup.confirmPassword !== signup.password ? "error" : undefined}
                  suffix={<button type="button" onClick={() => setSuShowConfirm(p => !p)}>{suShowConfirm ? <EyeOff size={16} className="text-white/40" /> : <Eye size={16} className="text-white/40" />}</button>}
                />
              </div>

              {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}
              <button
                onClick={() => { if (validateStep1()) { clearError(); setSignupStep(2); } }}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 mb-5"
                style={{ background: GRADIENT, boxShadow: "0 4px 20px rgba(255,0,110,0.35)" }}
              >
                Continue <ArrowRight size={16} />
              </button>

              <p className="text-center text-white/40 text-sm">
                Already have an account?{" "}
                <button onClick={() => { setMode("signin"); clearError(); }} className="font-semibold" style={{ color: "#FF3D9A" }}>Sign In</button>
              </p>
            </motion.div>
          )}

          {/* ══ SIGNUP — Step 2: about you ══════════════════════════════════════ */}
          {mode === "signup" && signupStep === 2 && (
            <motion.div key="su2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.18 }}>
              <div className="flex items-center justify-between mb-5">
                <button type="button" onClick={() => { setSignupStep(1); clearError(); }}><ArrowLeft size={20} className="text-white/60" /></button>
                <StepDots current={2} total={3} />
                <div className="w-6" />
              </div>

              <h2 className="text-xl font-bold text-white mb-1">About you</h2>
              <p className="text-white/40 text-sm mb-5">Help others find and know you</p>

              <div className="flex flex-col gap-3 mb-5">
                <Field
                  icon={<User size={18} className="text-white/40 flex-shrink-0" />}
                  value={signup.displayName} onChange={(v) => { su({ displayName: v }); clearError(); }}
                  placeholder="Display name (e.g. Alex)"
                />

                {/* Country */}
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Globe size={18} className="text-white/40 flex-shrink-0" />
                  <select
                    value={signup.country}
                    onChange={(e) => {
                      const c = COUNTRIES.find(x => x.name === e.target.value);
                      su({ country: e.target.value, countryFlag: c?.flag ?? "" });
                      clearError();
                    }}
                    className="flex-1 bg-transparent text-sm outline-none appearance-none cursor-pointer"
                    style={{ color: signup.country ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}
                  >
                    <option value="" disabled style={{ background: "#160d26" }}>Select your country</option>
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.name} style={{ background: "#160d26", color: "white" }}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Age */}
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Calendar size={18} className="text-white/40 flex-shrink-0" />
                  <input
                    type="number" min="13" max="120"
                    value={signup.age}
                    onChange={(e) => { su({ age: e.target.value }); clearError(); }}
                    placeholder="Your age"
                    className="flex-1 bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30"
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}
              <button
                onClick={() => { if (validateStep2()) { clearError(); setSignupStep(3); } }}
                className="w-full py-4 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: GRADIENT, boxShadow: "0 4px 20px rgba(255,0,110,0.35)" }}
              >
                Continue <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {/* ══ SIGNUP — Step 3: photo ═══════════════════════════════════════════ */}
          {mode === "signup" && signupStep === 3 && (
            <motion.div key="su3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.18 }}>
              <div className="flex items-center justify-between mb-5">
                <button type="button" onClick={() => { setSignupStep(2); clearError(); }}><ArrowLeft size={20} className="text-white/60" /></button>
                <StepDots current={3} total={3} />
                <div className="w-6" />
              </div>

              <h2 className="text-xl font-bold text-white mb-1">Add your photo</h2>
              <p className="text-white/40 text-sm mb-6">Help people recognize you</p>

              <div className="flex justify-center mb-5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-32 h-32 rounded-full overflow-hidden flex items-center justify-center group"
                  style={{
                    background: signup.avatarUrl ? "transparent" : "rgba(255,255,255,0.06)",
                    border: signup.avatarUrl ? "3px solid rgba(255,0,110,0.5)" : "2px dashed rgba(255,255,255,0.2)",
                  }}
                >
                  {signup.avatarUrl ? (
                    <>
                      <img src={signup.avatarUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera size={26} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 pointer-events-none">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(255,0,110,0.15)" }}>
                        <Camera size={24} style={{ color: "#FF006E" }} />
                      </div>
                      <span className="text-white/40 text-xs">Tap to add</span>
                    </div>
                  )}
                </button>
              </div>

              {signup.avatarUrl && (
                <div className="flex justify-center mb-4">
                  <button type="button" onClick={() => su({ avatarUrl: null })} className="flex items-center gap-1.5 text-white/35 text-xs hover:text-white/60 transition-colors">
                    <X size={13} /> Remove photo
                  </button>
                </div>
              )}

              {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}

              <PrimaryBtn onClick={handleRegister}>
                <span>Create Account</span><ArrowRight size={16} />
              </PrimaryBtn>

              {!signup.avatarUrl && (
                <button
                  type="button"
                  onClick={() => { su({ avatarUrl: null }); handleRegister(); }}
                  disabled={loading}
                  className="w-full py-3 text-white/35 text-sm hover:text-white/55 transition-colors mt-2"
                >
                  Skip for now
                </button>
              )}
            </motion.div>
          )}

          {/* ══ FORGOT PASSWORD ══════════════════════════════════════════════════ */}
          {mode === "forgot" && (
            <motion.div key={`fp${forgotStep}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.18 }}>
              <div className="flex items-center mb-5">
                <button type="button" onClick={() => { forgotStep === 1 ? setMode("signin") : setForgotStep(1); clearError(); }}>
                  <ArrowLeft size={20} className="text-white/60" />
                </button>
              </div>

              {forgotStep === 1 ? (
                <>
                  <h2 className="text-xl font-bold text-white mb-1">Reset password</h2>
                  <p className="text-white/40 text-sm mb-5">Enter your username to continue</p>
                  <div className="mb-5">
                    <Field icon={<User size={18} className="text-white/40 flex-shrink-0" />} value={forgotUsername} onChange={(v) => { setForgotUsername(v); clearError(); }} placeholder="Your username" />
                  </div>
                  {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}
                  <PrimaryBtn onClick={handleForgotLookup}><span>Continue</span><ArrowRight size={16} /></PrimaryBtn>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-1">New password</h2>
                  <p className="text-white/40 text-sm mb-5">
                    Set a new password for{" "}
                    <span className="text-white/80 font-medium">@{forgotUsername}</span>
                  </p>
                  <div className="flex flex-col gap-3 mb-5">
                    <Field
                      icon={<Lock size={18} className="text-white/40 flex-shrink-0" />}
                      value={forgotNewPw} onChange={(v) => { setForgotNewPw(v); clearError(); }}
                      placeholder="New password (min 6 characters)" type={forgotShowPw ? "text" : "password"}
                      suffix={<button type="button" onClick={() => setForgotShowPw(p => !p)}>{forgotShowPw ? <EyeOff size={16} className="text-white/40" /> : <Eye size={16} className="text-white/40" />}</button>}
                    />
                    <Field
                      icon={<Lock size={18} className="text-white/40 flex-shrink-0" />}
                      value={forgotConfirm} onChange={(v) => { setForgotConfirm(v); clearError(); }}
                      placeholder="Confirm new password" type="password"
                      highlight={forgotConfirm && forgotConfirm === forgotNewPw ? "ok" : forgotConfirm && forgotConfirm !== forgotNewPw ? "error" : undefined}
                    />
                  </div>
                  {forgotDone && (
                    <p className="text-green-400 text-xs text-center mb-4 flex items-center justify-center gap-1.5">
                      <CheckCircle size={14} /> Password updated! Redirecting to sign in…
                    </p>
                  )}
                  {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}
                  <PrimaryBtn onClick={handleForgotReset} disabled={loading || forgotDone}>
                    <span>Reset Password</span><ArrowRight size={16} />
                  </PrimaryBtn>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
