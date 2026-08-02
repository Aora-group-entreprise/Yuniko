import { useLocation } from "wouter";
import { ArrowLeft, ChevronRight, User, Lock, Bell, Eye, Shield, HardDrive, Info, LogOut, Trash2, Moon, Sun, Globe, BadgeCheck } from "lucide-react";
import { t, availableLanguages, getLang, setLang, Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { currentUser } from "@/data/mockData";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/auth-context";

const GRADIENT = "linear-gradient(135deg, #FF006E 0%, #8B00FF 100%)";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user: authUser, logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [lang, setLangState] = useState(getLang());

  const sections = [
    {
      title: t("account"),
      icon: User,
      color: "#FF3D9A",
      items: [
        { label: "Edit Profile", href: "/profile/edit", icon: User },
        { label: "Username & Email", href: "/settings/account", icon: User },
        { label: t("verify"), href: "/account/verify", icon: BadgeCheck },
      ],
    },
    {
      title: t("privacy"),
      icon: Eye,
      color: "#B054FF",
      items: [
        { label: t("privacy"), href: "/settings/privacy", icon: Eye },
        { label: t("blockedUsers"), href: "/blocked-users", icon: Lock },
      ],
    },
    {
      title: t("security"),
      icon: Shield,
      color: "#FF6EB4",
      items: [
        { label: t("twoFactor"), href: "/settings/security", icon: Shield },
        { label: t("activeSessions"), href: "/settings/security", icon: Shield },
        { label: t("loginHistory"), href: "/settings/security", icon: Shield },
      ],
    },
    {
      title: "Notifications",
      icon: Bell,
      color: "#FF9A3C",
      items: [
        { label: "Push Notifications", href: "/settings/privacy", icon: Bell },
        { label: "Email Notifications", href: "/settings/privacy", icon: Bell },
      ],
    },
    {
      title: t("storage"),
      icon: HardDrive,
      color: "#60D4B0",
      items: [
        { label: t("cacheManagement"), href: "/settings/storage", icon: HardDrive },
        { label: t("downloadData"), href: "/settings/storage", icon: HardDrive },
      ],
    },
    {
      title: t("about"),
      icon: Info,
      color: "#7EB9FF",
      items: [
        { label: t("helpCenter"), href: "/help", icon: Info },
        { label: t("feedback"), href: "/feedback", icon: Info },
        { label: t("termsOfService"), href: "/settings/about", icon: Info },
        { label: t("privacyPolicy"), href: "/settings/about", icon: Info },
        { label: `${t("appVersion")} 1.0.0`, href: "/settings/about", icon: Info },
      ],
    },
  ];

  const changeLang = (code: Lang) => {
    setLang(code);
    setLangState(code);
    setShowLangPicker(false);
    window.location.reload();
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation("/profile");
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-24">
      {/* Header */}
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{
          background: "rgba(13,11,20,0.96)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        data-testid="settings-header"
      >
        <button onClick={goBack} data-testid="btn-back-settings">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("settings")}</h1>
      </header>

      {/* Profile summary */}
      <button
        onClick={() => setLocation("/profile")}
        className="w-full flex items-center gap-3 px-4 py-4 active:bg-white/5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="btn-settings-profile"
      >
        <div className="relative">
          <div
            className="w-[58px] h-[58px] rounded-full p-[2px]"
            style={{ background: GRADIENT }}
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.displayName}
              className="w-full h-full rounded-full object-cover"
              style={{ border: "2px solid #0D0B14" }}
            />
          </div>
          {currentUser.verified && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "#0D0B14" }}
            >
              <BadgeCheck size={14} className="text-blue-400 fill-blue-400" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold">{currentUser.displayName}</p>
          <p className="text-white/50 text-sm">@{currentUser.username}</p>
        </div>
        <ChevronRight size={18} className="text-white/30" />
      </button>

      {/* Appearance section */}
      <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">{t("appearance")}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setTheme("dark")}
            className="flex-1 flex items-center gap-2 px-3 py-3 rounded-xl"
            style={{
              background: theme === "dark" ? "rgba(255,0,110,0.12)" : "rgba(255,255,255,0.05)",
              border: theme === "dark" ? "1px solid rgba(255,0,110,0.4)" : "1px solid rgba(255,255,255,0.08)",
            }}
            data-testid="btn-dark-mode"
          >
            <Moon size={16} style={{ color: theme === "dark" ? "#FF3D9A" : "rgba(255,255,255,0.5)" }} />
            <span className="text-sm font-medium" style={{ color: theme === "dark" ? "#FF3D9A" : "rgba(255,255,255,0.5)" }}>
              {t("darkMode")}
            </span>
          </button>
          <button
            onClick={() => setTheme("light")}
            className="flex-1 flex items-center gap-2 px-3 py-3 rounded-xl"
            style={{
              background: theme === "light" ? "rgba(255,0,110,0.12)" : "rgba(255,255,255,0.05)",
              border: theme === "light" ? "1px solid rgba(255,0,110,0.4)" : "1px solid rgba(255,255,255,0.08)",
            }}
            data-testid="btn-light-mode"
          >
            <Sun size={16} style={{ color: theme === "light" ? "#FF3D9A" : "rgba(255,255,255,0.5)" }} />
            <span className="text-sm font-medium" style={{ color: theme === "light" ? "#FF3D9A" : "rgba(255,255,255,0.5)" }}>
              {t("lightMode")}
            </span>
          </button>
        </div>
      </div>

      {/* Language section */}
      <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">{t("language")}</p>
        <button
          onClick={() => setShowLangPicker(true)}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          data-testid="btn-language"
        >
          <Globe size={16} style={{ color: "#FF3D9A" }} />
          <span className="text-white/80 text-sm flex-1 text-left">
            {availableLanguages.find((l) => l.code === lang)?.flag}{" "}
            {availableLanguages.find((l) => l.code === lang)?.name}
          </span>
          <ChevronRight size={16} className="text-white/30" />
        </button>
      </div>

      {/* Settings sections */}
      {sections.map((section) => (
        <div key={section.title} className="px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">{section.title}</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {section.items.map((item, i) => (
              <button
                key={item.label}
                onClick={() => setLocation(item.href)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/5"
                style={{ borderBottom: i < section.items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                data-testid={`settings-item-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${section.color}18` }}
                >
                  <item.icon size={16} style={{ color: section.color }} />
                </div>
                <span className="flex-1 text-white/80 text-sm">{item.label}</span>
                <ChevronRight size={14} className="text-white/25" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Danger zone */}
      <div className="px-4 py-4">
        <button
          onClick={() => setShowLogout(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-3 active:opacity-80"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
          data-testid="btn-logout"
        >
          <LogOut size={18} className="text-red-400" />
          <span className="text-red-400 font-medium text-sm">{t("logout")}</span>
        </button>
        <button
          onClick={() => setLocation("/account/delete")}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl active:opacity-80"
          style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}
          data-testid="btn-delete-account"
        >
          <Trash2 size={18} className="text-red-400/60" />
          <span className="text-red-400/60 text-sm">{t("deleteAccount")}</span>
        </button>
      </div>

      <BottomNav />

      {/* Language picker */}
      {showLangPicker && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowLangPicker(false)} />
          <div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 rounded-t-2xl overflow-hidden"
            style={{ background: "rgba(18,15,30,0.98)", border: "1px solid rgba(255,0,110,0.15)" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-2" />
            <p className="text-white font-semibold text-sm px-5 py-3">{t("language")}</p>
            {availableLanguages.map((l) => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-white/5"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                data-testid={`lang-${l.code}`}
              >
                <span className="text-xl">{l.flag}</span>
                <span className="text-sm font-medium" style={{ color: lang === l.code ? "#FF3D9A" : "rgba(255,255,255,0.8)" }}>
                  {l.name}
                </span>
                {lang === l.code && <span className="ml-auto" style={{ color: "#FF3D9A" }}>✓</span>}
              </button>
            ))}
            <div className="h-6" />
          </div>
        </>
      )}

      {/* Logout confirmation */}
      {showLogout && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-6">
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "rgba(18,15,30,0.99)", border: "1px solid rgba(255,255,255,0.1)" }}
            data-testid="logout-dialog"
          >
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-white font-bold text-lg mb-2">{t("logout")}</h3>
              <p className="text-white/60 text-sm">{t("logoutConfirm")}</p>
            </div>
            <div className="flex" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => setShowLogout(false)}
                className="flex-1 py-4 text-white/60 font-medium text-sm"
                style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}
                data-testid="btn-cancel-logout"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => { setShowLogout(false); logout(); setLocation("/login"); }}
                className="flex-1 py-4 text-red-400 font-semibold text-sm"
                data-testid="btn-confirm-logout"
              >
                {t("logout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
