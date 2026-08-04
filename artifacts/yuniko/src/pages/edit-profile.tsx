import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, Check, AlertCircle } from "lucide-react";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

const fallbackCover = "https://picsum.photos/seed/yuniko_cover/800/400";
const fallbackAvatar = "https://picsum.photos/seed/yuniko_profile/200/200";

export default function EditProfile() {
  const [, setLocation] = useLocation();
  const { user, updateUser, isLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocationText] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setUsername(user.username);
    setBio(user.bio);
    setLocationText(user.location ?? user.country ?? "");
    setWebsite(user.website ?? "");
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!displayName.trim() || !username.trim()) { setError("Display name and username are required."); return; }
    setSaving(true); setError("");
    try {
      await updateUser({ display_name: displayName.trim(), username: username.trim().toLowerCase(), bio: bio.slice(0, 150), location: location.trim() || null, website: website.trim() || null });
      setSaved(true);
      setTimeout(() => { setSaved(false); setLocation("/profile"); }, 900);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save profile."); }
    finally { setSaving(false); }
  };

  if (isLoading || !user) {
    return <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background flex items-center justify-center"><p className="text-white/50">Loading your profile…</p></div>;
  }

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-40 px-4 py-4 flex items-center justify-between" style={{ background: "rgba(13,11,20,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }} data-testid="edit-profile-header">
        <button onClick={() => setLocation("/profile")} data-testid="btn-back-edit"><ArrowLeft size={22} className="text-white/80" /></button>
        <h1 className="text-base font-semibold text-white">{t("editProfile")}</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold text-white" style={{ background: saved ? "rgba(134,239,172,0.2)" : "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)", boxShadow: saved ? "none" : "0 2px 10px rgba(255,0,110,0.35)", opacity: saving ? 0.7 : 1 }} data-testid="btn-save-profile">
          {saved ? <><Check size={14} /> Saved</> : saving ? "Saving…" : t("saveChanges")}
        </button>
      </header>
      <div className="relative h-28 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,0,110,0.4), rgba(139,0,255,0.4))" }}>
        <img src={user.coverPhoto || fallbackCover} alt="Cover" className="w-full h-full object-cover opacity-70" />
        <button className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }} data-testid="btn-change-cover"><div className="flex flex-col items-center gap-1"><Camera size={22} className="text-white" /><span className="text-white text-xs font-medium">{t("editCoverPhoto")}</span></div></button>
      </div>
      <div className="flex justify-center -mt-8 mb-4"><div className="relative"><div className="w-20 h-20 rounded-full p-[2.5px]" style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 20px rgba(255,0,110,0.4)" }}><img src={user.avatarUrl || fallbackAvatar} alt={user.displayName} className="w-full h-full rounded-full object-cover" style={{ border: "2.5px solid #0D0B14" }} /></div><button className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,0.4)" }} data-testid="btn-change-avatar"><Camera size={20} className="text-white" /></button></div></div>
      <div className="px-4 flex flex-col gap-4">
        {error && <div className="flex gap-2 text-red-300 text-xs"><AlertCircle size={14} />{error}</div>}
        {[{ label: t("displayName"), value: displayName, onChange: setDisplayName, testId: "input-display-name" },{ label: t("username"), value: username, onChange: setUsername, testId: "input-username" },{ label: "Website", value: website, onChange: setWebsite, testId: "input-website" },{ label: "Location", value: location, onChange: setLocationText, testId: "input-location" }].map((field) => (
          <div key={field.label}><label className="text-white/50 text-xs font-semibold uppercase tracking-wider block mb-1.5">{field.label}</label><div className="px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}><input value={field.value} onChange={(e) => field.onChange(e.target.value)} className="w-full bg-transparent text-white text-sm outline-none" data-testid={field.testId} /></div></div>
        ))}
        <div><label className="text-white/50 text-xs font-semibold uppercase tracking-wider block mb-1.5">{t("bio")}</label><div className="px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}><textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-transparent text-white text-sm outline-none resize-none" rows={4} data-testid="input-bio" /></div><p className="text-white/30 text-xs mt-1 text-right">{bio.length}/150</p></div>
      </div>
    </div>
  );
}
