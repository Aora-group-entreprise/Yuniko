export type LanguageCode = string;

export interface LanguageOption { code: LanguageCode; name: string; nativeName: string; flag: string; }

// ISO 639-1 language catalog. Yuniko currently ships complete UI translations for
// English/French/Spanish; other languages remain selectable and safely fall back
// to English until their translation pack is added. Navigation labels stay English.
const entries: Array<[string,string,string,string]> = [
["af","Afrikaans","Afrikaans","🌍"],["am","Amharic","አማርኛ","🌍"],["ar","Arabic","العربية","🌍"],["az","Azerbaijani","Azərbaycanca","🌍"],["be","Belarusian","Беларуская","🌍"],["bg","Bulgarian","Български","🌍"],["bn","Bengali","বাংলা","🌍"],["bs","Bosnian","Bosanski","🌍"],["ca","Catalan","Català","🌍"],["cs","Czech","Čeština","🌍"],["cy","Welsh","Cymraeg","🌍"],["da","Danish","Dansk","🌍"],["de","German","Deutsch","🌍"],["el","Greek","Ελληνικά","🌍"],["en","English","English","🇬🇧"],["es","Spanish","Español","🇪🇸"],["et","Estonian","Eesti","🌍"],["eu","Basque","Euskara","🌍"],["fa","Persian","فارسی","🌍"],["fi","Finnish","Suomi","🌍"],["fil","Filipino","Filipino","🌍"],["fr","French","Français","🇫🇷"],["ga","Irish","Gaeilge","🌍"],["gl","Galician","Galego","🌍"],["gu","Gujarati","ગુજરાતી","🌍"],["he","Hebrew","עברית","🌍"],["hi","Hindi","हिन्दी","🌍"],["hr","Croatian","Hrvatski","🌍"],["hu","Hungarian","Magyar","🌍"],["hy","Armenian","Հայերեն","🌍"],["id","Indonesian","Bahasa Indonesia","🌍"],["is","Icelandic","Íslenska","🌍"],["it","Italian","Italiano","🌍"],["ja","Japanese","日本語","🇯🇵"],["jv","Javanese","Basa Jawa","🌍"],["ka","Georgian","ქართული","🌍"],["kk","Kazakh","Қазақша","🌍"],["km","Khmer","ខ្មែរ","🌍"],["kn","Kannada","ಕನ್ನಡ","🌍"],["ko","Korean","한국어","🇰🇷"],["ky","Kyrgyz","Кыргызча","🌍"],["la","Latin","Latina","🌍"],["lo","Lao","ລາວ","🌍"],["lt","Lithuanian","Lietuvių","🌍"],["lv","Latvian","Latviešu","🌍"],["mk","Macedonian","Македонски","🌍"],["ml","Malayalam","മലയാളം","🌍"],["mn","Mongolian","Монгол","🌍"],["mr","Marathi","मराठी","🌍"],["ms","Malay","Bahasa Melayu","🌍"],["mt","Maltese","Malti","🌍"],["my","Burmese","မြန်မာ","🌍"],["ne","Nepali","नेपाली","🌍"],["nl","Dutch","Nederlands","🌍"],["no","Norwegian","Norsk","🌍"],["or","Odia","ଓଡ଼ିଆ","🌍"],["pa","Punjabi","ਪੰਜਾਬੀ","🌍"],["pl","Polish","Polski","🌍"],["pt","Portuguese","Português","🌍"],["ro","Romanian","Română","🌍"],["ru","Russian","Русский","🌍"],["si","Sinhala","සිංහල","🌍"],["sk","Slovak","Slovenčina","🌍"],["sl","Slovenian","Slovenščina","🌍"],["so","Somali","Soomaali","🌍"],["sq","Albanian","Shqip","🌍"],["sr","Serbian","Српски","🌍"],["su","Sundanese","Basa Sunda","🌍"],["sv","Swedish","Svenska","🌍"],["sw","Swahili","Kiswahili","🌍"],["ta","Tamil","தமிழ்","🌍"],["te","Telugu","తెలుగు","🌍"],["tg","Tajik","Тоҷикӣ","🌍"],["th","Thai","ไทย","🌍"],["tk","Turkmen","Türkmençe","🌍"],["tr","Turkish","Türkçe","🌍"],["tt","Tatar","Татарча","🌍"],["uk","Ukrainian","Українська","🌍"],["ur","Urdu","اردو","🌍"],["uz","Uzbek","O‘zbek","🌍"],["vi","Vietnamese","Tiếng Việt","🌍"],["yi","Yiddish","ייִדיש","🌍"],["yo","Yoruba","Yorùbá","🌍"],["zh","Chinese","中文","🇨🇳"],["zu","Zulu","isiZulu","🌍"]
];

export const availableLanguages: LanguageOption[] = entries.map(([code,name,nativeName,flag]) => ({code,name,nativeName,flag}));

const STORAGE_KEY = "yuniko_language";

export function detectDeviceLanguage(): LanguageCode {
  const candidates = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const value of candidates) {
    const base = value?.toLowerCase().split("-")[0];
    if (base && availableLanguages.some(l => l.code === base)) return base;
  }
  return "en";
}

export function getLang(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && availableLanguages.some(l => l.code === stored)) return stored;
  return detectDeviceLanguage();
}

export function setLang(code: LanguageCode): void {
  if (typeof window !== "undefined" && availableLanguages.some(l => l.code === code)) {
    localStorage.setItem(STORAGE_KEY, code);
  }
}
