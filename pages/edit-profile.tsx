import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, Check, Loader } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api";
import { AuthUser } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

export default function EditProfile() {
  const [, setLocation] = useLocation();
  const { user, updateUser } = useAuth();

  // Initialise form from the real authenticated user
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [username] = useState(user?.username ?? ""); // username is read-only here
  const [bio, setBio] = useState(user?.bio ?? "");
  const [locationText, setLocationText] = useState(user?.country ?? "");
  const [website, setWebsite] = useState(user?.website ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avatar: start from whatever is stored; allow local preview change
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarChanged, setAvatarChanged] = useState(false);

  const avatarDisplay =
    avatarPreview ??
    `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user?.displayName ?? "U")}&backgroundColor=FF006E`;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      // Resize to 300x300 JPEG via canvas (matches the login flow)
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, 300, 300);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setAvatarPreview(dataUrl);
        setAvatarChanged(true);
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string | null> = {
        displayName,
        bio,
        website: website || null,
        country: locationText || null,
      };
      if (avatarChanged) {
        body["avatarUrl"] = avatarPreview;
      }

      const updated = await apiJson<AuthUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      updateUser(updated);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setLocation("/profile");
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-10">
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
          disabled={saving || saved}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-60"
          style={{
            background: saved
              ? "rgba(134,239,172,0.2)"
              : "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)",
            boxShadow: saved ? "none" : "0 2px 10px rgba(255,0,110,0.35)",
          }}
          data-testid="btn-save-profile"
        >
          {saving ? (
            <Loader size={14} className="animate-spin" />
          ) : saved ? (
            <><Check size={14} /> Saved</>
          ) : (
            t("saveChanges")
          )}
        </button>
      </header>

      {/* Cover photo — gradient only; full cover upload is a future feature */}
      <div
        className="relative h-28 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)" }}
      />

      {/* Avatar */}
      <div className="flex justify-center -mt-8 mb-4">
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full p-[2.5px]"
            style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 20px rgba(255,0,110,0.4)" }}
          >
            <img
              src={avatarDisplay}
              alt={displayName}
              className="w-full h-full rounded-full object-cover"
              style={{ border: "2.5px solid #0D0B14" }}
            />
          </div>
          <label
            className="absolute inset-0 flex items-center justify-center rounded-full cursor-pointer"
            style={{ background: "rgba(0,0,0,0.4)" }}
            data-testid="btn-change-avatar"
          >
            <Camera size={20} className="text-white" />
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </label>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-400 text-xs text-center px-4 mb-2">{error}</p>
      )}

      {/* Form fields */}
      <div className="px-4 flex flex-col gap-4">
        {[
          { label: t("displayName"), value: displayName, onChange: setDisplayName, testId: "input-display-name" },
          { label: t("username"), value: username, onChange: () => {}, testId: "input-username", readOnly: true },
          { label: "Website", value: website, onChange: setWebsite, testId: "input-website" },
          { label: "Country / Location", value: locationText, onChange: setLocationText, testId: "input-location" },
        ].map((field) => (
          <div key={field.label}>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wider block mb-1.5">
              {field.label}
              {field.readOnly && <span className="normal-case tracking-normal text-white/25 ml-2 font-normal">(cannot be changed)</span>}
            </label>
            <div
              className="px-4 py-3 rounded-xl"
              style={{
                background: field.readOnly ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <input
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                readOnly={field.readOnly}
                className="w-full bg-transparent text-white text-sm outline-none disabled:opacity-50"
                style={{ opacity: field.readOnly ? 0.5 : 1 }}
                data-testid={field.testId}
              />
            </div>
          </div>
        ))}

        <div>
          <label className="text-white/50 text-xs font-semibold uppercase tracking-wider block mb-1.5">{t("bio")}</label>
          <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={150}
              className="w-full bg-transparent text-white text-sm outline-none resize-none"
              rows={4}
              data-testid="input-bio"
            />
          </div>
          <p className="text-white/30 text-xs mt-1 text-right">{bio.length}/150</p>
        </div>
      </div>
    </div>
  );
}
