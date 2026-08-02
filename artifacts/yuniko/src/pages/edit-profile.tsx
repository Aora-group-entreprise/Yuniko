import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, Check } from "lucide-react";
import { currentUser } from "@/data/mockData";
import { t } from "@/lib/i18n";

export default function EditProfile() {
  const [, setLocation] = useLocation();
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio);
  const [location, setLocationText] = useState(currentUser.location);
  const [website, setWebsite] = useState("yuniko.app/@you");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); setLocation("/profile"); }, 1200);
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
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold text-white"
          style={{ background: saved ? "rgba(134,239,172,0.2)" : "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)", boxShadow: saved ? "none" : "0 2px 10px rgba(255,0,110,0.35)" }}
          data-testid="btn-save-profile"
        >
          {saved ? <><Check size={14} /> Saved</> : t("saveChanges")}
        </button>
      </header>

      {/* Cover photo */}
      <div className="relative h-28 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,0,110,0.4), rgba(139,0,255,0.4))" }}>
        <img src={currentUser.coverPhoto} alt="Cover" className="w-full h-full object-cover opacity-70" />
        <button
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)" }}
          data-testid="btn-change-cover"
        >
          <div className="flex flex-col items-center gap-1">
            <Camera size={22} className="text-white" />
            <span className="text-white text-xs font-medium">{t("editCoverPhoto")}</span>
          </div>
        </button>
      </div>

      {/* Avatar */}
      <div className="flex justify-center -mt-8 mb-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full p-[2.5px]" style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)", boxShadow: "0 0 20px rgba(255,0,110,0.4)" }}>
            <img src={currentUser.avatar} alt={currentUser.displayName} className="w-full h-full rounded-full object-cover" style={{ border: "2.5px solid #0D0B14" }} />
          </div>
          <button
            className="absolute inset-0 flex items-center justify-center rounded-full"
            style={{ background: "rgba(0,0,0,0.4)" }}
            data-testid="btn-change-avatar"
          >
            <Camera size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* Form fields */}
      <div className="px-4 flex flex-col gap-4">
        {[
          { label: t("displayName"), value: displayName, onChange: setDisplayName, testId: "input-display-name" },
          { label: t("username"), value: username, onChange: setUsername, testId: "input-username" },
          { label: "Website", value: website, onChange: setWebsite, testId: "input-website" },
          { label: "Location", value: location, onChange: setLocationText, testId: "input-location" },
        ].map((field) => (
          <div key={field.label}>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wider block mb-1.5">{field.label}</label>
            <div
              className="px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <input
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                className="w-full bg-transparent text-white text-sm outline-none"
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
