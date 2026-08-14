export type Lang = string;

export type LanguageOption = { code: Lang; name: string; flag: string };

// Complete language selector catalog. Translation packs are added independently;
// unsupported packs safely fall back to English instead of breaking the UI.
export const availableLanguages: LanguageOption[] = [
  ["en","English","🇬🇧"],["fr","Français","🇫🇷"],["es","Español","🇪🇸"],["mg","Malagasy","🇲🇬"],["de","Deutsch","🇩🇪"],["pt","Português","🇵🇹"],["it","Italiano","🇮🇹"],["nl","Nederlands","🇳🇱"],["sv","Svenska","🇸🇪"],["no","Norsk","🇳🇴"],["da","Dansk","🇩🇰"],["fi","Suomi","🇫🇮"],["is","Íslenska","🇮🇸"],["ga","Gaeilge","🇮🇪"],["cy","Cymraeg","🏴"],["pl","Polski","🇵🇱"],["cs","Čeština","🇨🇿"],["sk","Slovenčina","🇸🇰"],["sl","Slovenščina","🇸🇮"],["hr","Hrvatski","🇭🇷"],["bs","Bosanski","🇧🇦"],["sr","Srpski","🇷🇸"],["mk","Македонски","🇲🇰"],["bg","Български","🇧🇬"],["ro","Română","🇷🇴"],["hu","Magyar","🇭🇺"],["el","Ελληνικά","🇬🇷"],["sq","Shqip","🇦🇱"],["et","Eesti","🇪🇪"],["lv","Latviešu","🇱🇻"],["lt","Lietuvių","🇱🇹"],["uk","Українська","🇺🇦"],["ru","Русский","🇷🇺"],["be","Беларуская","🇧🇾"],["tr","Türkçe","🇹🇷"],["az","Azərbaycan dili","🇦🇿"],["hy","Հայերեն","🇦🇲"],["ka","ქართული","🇬🇪"],["he","עברית","🇮🇱"],["ar","العربية","🇸🇦"],["fa","فارسی","🇮🇷"],["ur","اردو","🇵🇰"],["ps","پښتو","🇦🇫"],["ku","Kurdî","🌐"],["hi","हिन्दी","🇮🇳"],["bn","বাংলা","🇧🇩"],["pa","ਪੰਜਾਬੀ","🇮🇳"],["gu","ગુજરાતી","🇮🇳"],["mr","मराठी","🇮🇳"],["ne","नेपाली","🇳🇵"],["si","සිංහල","🇱🇰"],["ta","தமிழ்","🇮🇳"],["te","తెలుగు","🇮🇳"],["kn","ಕನ್ನಡ","🇮🇳"],["ml","മലയാളം","🇮🇳"],["or","ଓଡ଼ିଆ","🇮🇳"],["as","অসমীয়া","🇮🇳"],["my","မြန်မာ","🇲🇲"],["th","ไทย","🇹🇭"],["lo","ລາວ","🇱🇦"],["km","ខ្មែរ","🇰🇭"],["vi","Tiếng Việt","🇻🇳"],["id","Bahasa Indonesia","🇮🇩"],["ms","Bahasa Melayu","🇲🇾"],["tl","Filipino","🇵🇭"],["jv","Basa Jawa","🇮🇩"],["su","Basa Sunda","🇮🇩"],["zh","中文","🇨🇳"],["ja","日本語","🇯🇵"],["ko","한국어","🇰🇷"],["mn","Монгол","🇲🇳"],["bo","བོད་ཡིག","🌐"],["sw","Kiswahili","🌍"],["am","አማርኛ","🇪🇹"],["ha","Hausa","🌍"],["yo","Yorùbá","🌍"],["ig","Igbo","🌍"],["zu","isiZulu","🇿🇦"],["xh","isiXhosa","🇿🇦"],["af","Afrikaans","🇿🇦"],["so","Soomaali","🇸🇴"],["rw","Kinyarwanda","🇷🇼"],["sn","chiShona","🇿🇼"],["st","Sesotho","🇱🇸"],["tn","Setswana","🇧🇼"],["ny","Chichewa","🇲🇼"],["lg","Luganda","🇺🇬"],["wo","Wolof","🇸🇳"],["ff","Fulfulde","🌍"],["ln","Lingála","🌍"],["kg","Kikongo","🌍"],["ber","Tamazight","🌍"],["yo","Yorùbá","🌍"],["la","Latina","🏛️"],["eo","Esperanto","🌐"],["jv","Javanese","🇮🇩"],["su","Sundanese","🇮🇩"],["fil","Filipino","🇵🇭"],["ca","Català","🇪🇸"],["eu","Euskara","🇪🇸"],["gl","Galego","🇪🇸"],["mt","Malti","🇲🇹"],["lb","Lëtzebuergesch","🇱🇺"],["fy","Frysk","🇳🇱"],["gd","Gàidhlig","🏴"],["br","Brezhoneg","🇫🇷"],["co","Corsu","🇫🇷"],["oc","Occitan","🇫🇷"],["rm","Rumantsch","🇨🇭"],["eo","Esperanto","🌐"]
].map(([code,name,flag]) => ({ code, name, flag }));

const translations: Record<string, Record<string, string>> = {
  en: {
    home:"Home", notifications:"Notifications", messages:"Messages", profile:"Profile", search:"Search", create:"Create", worldFeed:"World Feed", settings:"Settings", language:"Language", appearance:"Appearance", privacy:"Privacy", security:"Security", storage:"Storage", about:"About", logout:"Log Out", logoutConfirm:"Are you sure you want to log out?", cancel:"Cancel", confirm:"Confirm", darkMode:"Dark Mode", lightMode:"Light Mode", blockedUsers:"Blocked Users", verify:"Verify Account", twoFactor:"Two-Factor Authentication", activeSessions:"Active Sessions", loginHistory:"Login History", cacheManagement:"Clear Cache", downloadData:"Download My Data", helpCenter:"Help Center", feedback:"Send Feedback", termsOfService:"Terms of Service", privacyPolicy:"Privacy Policy", appVersion:"App Version", deleteAccount:"Delete Account"
  },
  fr: {
    home:"Accueil", notifications:"Notifications", messages:"Messages", profile:"Profil", search:"Recherche", create:"Créer", worldFeed:"Fil Mondial", settings:"Paramètres", language:"Langue", appearance:"Apparence", privacy:"Confidentialité", security:"Sécurité", storage:"Stockage", about:"À propos", logout:"Déconnexion", logoutConfirm:"Voulez-vous vraiment vous déconnecter ?", cancel:"Annuler", confirm:"Confirmer", darkMode:"Mode sombre", lightMode:"Mode clair", blockedUsers:"Utilisateurs bloqués", verify:"Vérifier le compte", twoFactor:"Authentification à deux facteurs", activeSessions:"Sessions actives", loginHistory:"Historique de connexion", cacheManagement:"Vider le cache", downloadData:"Télécharger mes données", helpCenter:"Centre d'aide", feedback:"Envoyer un commentaire", termsOfService:"Conditions d'utilisation", privacyPolicy:"Politique de confidentialité", appVersion:"Version de l'application", deleteAccount:"Supprimer le compte"
  },
  es: {
    home:"Inicio", notifications:"Notificaciones", messages:"Mensajes", profile:"Perfil", search:"Buscar", create:"Crear", worldFeed:"Feed Mundial", settings:"Ajustes", language:"Idioma", appearance:"Apariencia", privacy:"Privacidad", security:"Seguridad", storage:"Almacenamiento", about:"Acerca de", logout:"Cerrar sesión", logoutConfirm:"¿Seguro que quieres cerrar sesión?", cancel:"Cancelar", confirm:"Confirmar", darkMode:"Modo oscuro", lightMode:"Modo claro", blockedUsers:"Usuarios bloqueados", verify:"Verificar cuenta", twoFactor:"Autenticación en dos pasos", activeSessions:"Sesiones activas", loginHistory:"Historial de inicio", cacheManagement:"Limpiar caché", downloadData:"Descargar mis datos", helpCenter:"Centro de ayuda", feedback:"Enviar comentarios", termsOfService:"Términos de servicio", privacyPolicy:"Política de privacidad", appVersion:"Versión de la app", deleteAccount:"Eliminar cuenta"
  },
  mg: {
    home:"Fandraisana", notifications:"Fampandrenesana", messages:"Hafatra", profile:"Profil", search:"Fikarohana", create:"Mamorona", worldFeed:"Feed Maneran-tany", settings:"Fikirana", language:"Fiteny", appearance:"Endrika", privacy:"Tsiambaratelo", security:"Fiarovana", storage:"Fitahirizana", about:"Momba", logout:"Hivoaka", logoutConfirm:"Te hivoaka tokoa ve ianao?", cancel:"Hanafoana", confirm:"Hanamarina", darkMode:"Maody maizina", lightMode:"Maody mazava", blockedUsers:"Mpampiasa voasakana", verify:"Hamarino ny kaonty", twoFactor:"Fanamarinana dingana roa", activeSessions:"Session mavitrika", loginHistory:"Tantaran'ny fidirana", cacheManagement:"Hamafa cache", downloadData:"Hisintona ny angonako", helpCenter:"Foibe fanampiana", feedback:"Handefa hevitra", termsOfService:"Fepetra fampiasana", privacyPolicy:"Politikan'ny tsiambaratelo", appVersion:"Dikan'ny app", deleteAccount:"Hamafa kaonty"
  }
};

const supported = new Set(Object.keys(translations));

export function getLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("yuniko-language");
  if (saved) return saved;
  const browser = (navigator.language || "en").split("-")[0];
  return browser || "en";
}

export function setLang(lang: Lang): void {
  if (typeof window !== "undefined") localStorage.setItem("yuniko-language", lang);
}

export function t(key: string, lang: Lang = getLang()): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

export function isLanguageTranslated(lang: Lang): boolean {
  return supported.has(lang);
}

export default translations;
