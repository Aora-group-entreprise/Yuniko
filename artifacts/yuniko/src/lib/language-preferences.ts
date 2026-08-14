import type { Lang } from "@/lib/i18n";

const LANGUAGE_KEY = "yuniko_language";

export const availableLanguages: Array<{ code: Lang; name: string; flag: string }> = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
];

function normalizeLanguage(value: string | null | undefined): Lang | null {
  if (!value) return null;
  const code = value.toLowerCase().split("-")[0];
  return code === "fr" || code === "es" || code === "en" ? code : null;
}

/** Detect the device/browser language before the user has an account. */
export function detectDeviceLanguage(): Lang {
  if (typeof navigator === "undefined") return "en";
  return normalizeLanguage(navigator.language) ?? "en";
}

/**
 * Default app language for a selected country.
 * Countries with French or Spanish as a major/default supported language use
 * that language; all other countries fall back to English because Yuniko's
 * supported UI languages are currently English, French and Spanish.
 */
export function languageForCountry(countryOrCode: string | null | undefined): Lang {
  const value = (countryOrCode ?? "").trim().toLowerCase();
  if (!value) return detectDeviceLanguage();

  const french = new Set([
    "fr", "france", "be", "belgium", "belgique", "ca", "canada", "ch", "switzerland", "suisse",
    "lu", "luxembourg", "mc", "monaco", "mg", "madagascar", "sn", "senegal", "ci", "cote d'ivoire",
    "côte d'ivoire", "cm", "cameroon", "cameroun", "cd", "democratic republic of the congo",
    "cg", "republic of the congo", "ga", "gabon", "bj", "benin", "bf", "burkina faso", "ne", "niger",
    "ml", "mali", "td", "chad", "togo", "tg", "gn", "guinea", "rw", "rwanda", "bi", "burundi",
    "ht", "haiti", "dj", "djibouti", "km", "comoros", "vu", "vanuatu"
  ]);
  if (french.has(value)) return "fr";

  const spanish = new Set([
    "es", "spain", "espagne", "mx", "mexico", "méxico", "ar", "argentina", "bo", "bolivia",
    "cl", "chile", "co", "colombia", "cr", "costa rica", "cu", "cuba", "do", "dominican republic",
    "ec", "ecuador", "sv", "el salvador", "gq", "equatorial guinea", "gt", "guatemala", "hn", "honduras",
    "ni", "nicaragua", "pa", "panama", "py", "paraguay", "pe", "peru", "pr", "puerto rico",
    "uy", "uruguay", "ve", "venezuela"
  ]);
  if (spanish.has(value)) return "es";

  return "en";
}

export function getLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = normalizeLanguage(localStorage.getItem(LANGUAGE_KEY));
  return saved ?? detectDeviceLanguage();
}

export function setLang(lang: Lang, persist = true): void {
  if (typeof window === "undefined") return;
  if (persist) localStorage.setItem(LANGUAGE_KEY, lang);
}

/** Apply the selected signup country as the user's default language. */
export function setLanguageFromCountry(country: string | null | undefined): Lang {
  const lang = languageForCountry(country);
  setLang(lang, true);
  return lang;
}
