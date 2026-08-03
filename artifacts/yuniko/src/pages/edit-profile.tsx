import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, Check, Trash2 } from "lucide-react";
import { currentUser } from "@/data/mockData";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

async function processAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function EditProfile() {
  const [, setLocation] = useLocation();
  const { user, token, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUrl(await processAvatar(file));
      setError("");
    } catch {
      setError("Failed to process image. Try another photo.");
    }
    event.target.value = "";
  };

  const handleSave = async () => {
    if (!token) {
      setError("Please sign in again before editing your profile.");
      return;
    }
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          username: username.trim().toLowerCase(),
          bio,
          avatarUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Unable to save profile.");
        return;
      }
      updateUser(data);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setLocation("/profile");
      }, 800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const avatar = avatarUrl ?? currentUser.avatar;

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-10">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center justify-between"
        style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="edit-profile-header"
      >
        <button onClick={() => setLocation("/profile")} data-testid="btn-back-edit">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("editProfile")}</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: saved ? "rgba(134,239,172,0.2)" : "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)", boxShadow: saved ? "none" : "0 2px 10px rgba(255,0,110,0.35)" }}
          data-testid="btn-save-profile"
        >
          {saved ? <><Check size={14} /> Saved</> : saving ? "Saving..." : t("saveChanges")}
        </button>
      </header>

      <div className="flex justify-center pt-8 mb-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full p-[2.5px]" style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 20px rgba(255,0,110,0.4)" }}>
            <img src={avatar} alt={displayName} className="w-full h-full rounded-full object-cover" style={{ border: "2.5px solid #0D0B14" }} />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center rounded-full"
            style={{ background: "rgba(0,0,0,0.4)" }}
            data-testid="btn-change-avatar"
          >
            <Camera size={20} className="text-white" />
          </button>
        </div>
      </div>

      <div className="flex justify-center mb-4">
        <button onClick={() => setAvatarUrl(null)} className="flex items-center gap-1.5 text-white/45 text-xs">
          <Trash2 size={13} /> Remove profile picture
        </button>
      </div>

      <div className="px-4 flex flex-col gap-4">
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        {[
          { label: t("displayName"), value: displayName, onChange: setDisplayName, testId: "input-display-name" },
          { label: t("username"), value: username, onChange: (value: string) => setUsername(value.replace(/[^a-zA-Z0-9._]/g, "")), testId: "input-username" },
        ].map((field) => (
          <div key={field.label}>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wider block mb-1.5">{field.label}</label>
            <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <input value={field.value} onChange={(e) => field.onChange(e.target.value)} className="w-full bg-transparent text-white text-sm outline-none" data-testid={field.testId} />
            </div>
          </div>
        ))}
        <div>
          <label className="text-white/50 text-xs font-semibold uppercase tracking-wider block mb-1.5">{t("bio")}</label>
          <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 150))} className="w-full bg-transparent text-white text-sm outline-none resize-none" rows={4} data-testid="input-bio" />
          </div>
          <p className="text-white/30 text-xs mt-1 text-right">{bio.length}/150</p>
        </div>
      </div>
    </div>
  );
}
