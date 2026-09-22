import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, HardDrive, Download, Trash2, Check, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { apiJson } from "@/lib/api";
import BottomNav from "@/components/BottomNav";

type StorageSettingsData = {
  clearCacheOnExit: boolean;
  deleteWatchedStories: boolean;
};

export default function StorageSettings() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<StorageSettingsData>({
    clearCacheOnExit: false,
    deleteWatchedStories: false,
  });
  const [cleared, setCleared] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiJson<StorageSettingsData>("/settings")
      .then((data) => {
        if (!cancelled) {
          setSettings({
            clearCacheOnExit: Boolean(data.clearCacheOnExit),
            deleteWatchedStories: Boolean(data.deleteWatchedStories),
          });
        }
      })
      .catch(() => {
        // Keep safe local defaults if settings cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleClearCache = () => {
    const keepKeys = new Set(["yuniko_token", "yuniko_user", "yuniko_lang"]);

    Object.keys(localStorage).forEach((key) => {
      if (!keepKeys.has(key)) {
        localStorage.removeItem(key);
      }
    });

    setCleared(true);
    window.setTimeout(() => setCleared(false), 2000);
  };

  const updateSetting = async (
    key: keyof StorageSettingsData,
    value: boolean,
  ) => {
    const previous = settings[key];
    setSettings((current) => ({ ...current, [key]: value }));
    setSaving(true);

    try {
      await apiJson("/settings", {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      setSettings((current) => ({ ...current, [key]: previous }));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadData = async () => {
    if (exporting) return;

    setExporting(true);

    try {
      const payload = await apiJson<unknown>("/settings/export");

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "yuniko-data.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Unable to export your Yuniko data right now.");
    } finally {
      setExporting(false);
    }
  };

  const autoDeleteItems = [
    {
      key: "clearCacheOnExit" as const,
      label: "Clear cache on exit",
      description: "Automatically clear cache when closing the app",
    },
    {
      key: "deleteWatchedStories" as const,
      label: "Delete watched stories",
      description: "Remove stories after you've viewed them",
    },
  ];

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background pb-20">
      <header
        className="sticky top-0 z-40 px-4 py-4 flex items-center gap-3"
        style={{
          background: "rgba(13,11,20,0.95)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button onClick={() => setLocation("/settings")} data-testid="btn-back-storage">
          <ArrowLeft size={22} className="text-white/80" />
        </button>
        <h1 className="text-base font-semibold text-white">{t("storage")}</h1>
      </header>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div
          className="p-4 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive size={16} style={{ color: "#FF3D9A" }} />
              <span className="text-white font-semibold text-sm">App Storage</span>
            </div>
            <span className="text-white/50 text-sm">Local cache</span>
          </div>
          <p className="text-white/40 text-xs">
            Yuniko stores authentication and language preferences locally. Clearing
            the cache keeps your signed-in session and language.
          </p>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <button
            onClick={handleClearCache}
            className="w-full flex items-center gap-3 px-4 py-4"
            data-testid="btn-clear-cache"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.15)" }}
            >
              {cleared ? (
                <Check size={16} className="text-green-400" />
              ) : (
                <Trash2 size={16} className="text-red-400" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-white/85 text-sm font-medium">
                {cleared ? "Cache Cleared!" : t("cacheManagement")}
              </p>
              <p className="text-white/40 text-xs mt-0.5">
                {cleared
                  ? "Local cache cleared successfully"
                  : "Remove temporary local app data"}
              </p>
            </div>
          </button>

          <div
            className="flex items-center gap-3 px-4 py-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.15)" }}
            >
              <Download size={16} className="text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="text-white/85 text-sm font-medium">{t("downloadData")}</p>
              <p className="text-white/40 text-xs mt-0.5">
                Download a complete JSON export of your Yuniko account data
              </p>
            </div>
            <button
              onClick={handleDownloadData}
              disabled={exporting}
              className="px-3 py-1 rounded-full text-xs font-medium text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #FF006E, #8B00FF)" }}
              data-testid="btn-download-data"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : "Download"}
            </button>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/50 text-xs uppercase tracking-wider">Auto-Delete</p>
            {saving && <Loader2 size={13} className="animate-spin text-white/40" />}
          </div>

          {autoDeleteItems.map((item, i) => {
            const enabled = settings[item.key];

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => updateSetting(item.key, !enabled)}
                className={`w-full flex items-center gap-3 text-left ${i > 0 ? "mt-3 pt-3 border-t border-white/[0.06]" : ""}`}
                aria-pressed={enabled}
              >
                <div className="flex-1">
                  <p className="text-white/80 text-sm">{item.label}</p>
                  <p className="text-white/35 text-xs mt-0.5">{item.description}</p>
                </div>
                <div
                  className="w-10 h-6 rounded-full p-0.5 transition-colors"
                  style={{
                    background: enabled
                      ? "linear-gradient(135deg, #FF006E, #8B00FF)"
                      : "rgba(255,255,255,0.12)",
                  }}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
