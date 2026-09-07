import { availableLanguages, getLang, setLang, type Lang } from "@/lib/i18n";

export { availableLanguages, getLang, setLang };

function normalizeLanguage(value: string | null | undefined): Lang | null {
  if (!value) return null;
  const code = value.toLowerCase().split("-")[0];
  return availableLanguages.some(language => language.code === code) ? code : null;
}

export function detectDeviceLanguage(): Lang {
  if (typeof navigator === "undefined") return "en";
  return normalizeLanguage(navigator.language) ?? "en";
}

export function languageForCountry(countryOrCode: string | null | undefined): Lang {
  const value = (countryOrCode ?? "").trim().toLowerCase();
  if (!value) return detectDeviceLanguage();
  const french = new Set(["fr","france","be","belgium","belgique","ca","canada","ch","switzerland","suisse","lu","luxembourg","mc","monaco","mg","madagascar","sn","senegal","ci","cote d'ivoire","côte d'ivoire","cm","cameroon","cameroun","cd","democratic republic of the congo","cg","republic of the congo","ga","gabon","bj","benin","bf","burkina faso","ne","niger","ml","mali","td","chad","togo","tg","gn","guinea","rw","rwanda","bi","burundi","ht","haiti","dj","djibouti","km","comoros","vu","vanuatu"]);
  if (french.has(value)) return "fr";
  const spanish = new Set(["es","spain","espagne","mx","mexico","méxico","ar","argentina","bo","bolivia","cl","chile","co","colombia","cr","costa rica","cu","cuba","do","dominican republic","ec","ecuador","sv","el salvador","gq","equatorial guinea","gt","guatemala","hn","honduras","ni","nicaragua","pa","panama","py","paraguay","pe","peru","pr","puerto rico","uy","uruguay","ve","venezuela"]);
  if (spanish.has(value)) return "es";
  return "en";
}

export function setLanguageFromCountry(country: string | null | undefined): Lang {
  const lang = languageForCountry(country);
  setLang(lang);
  return lang;
}
