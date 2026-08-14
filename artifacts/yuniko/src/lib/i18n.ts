export type Lang = string;

export type LanguageOption = { code: Lang; name: string; flag: string };

// Complete user-facing language catalog. Translations that are not yet available
// safely fall back to English; adding a language never changes routes or API names.
export const availableLanguages: LanguageOption[] = [
  ["af","Afrikaans","🇿🇦"],["sq","Shqip","🇦🇱"],["am","አማርኛ","🇪🇹"],["ar","العربية","🌐"],["hy","Հայերեն","🇦🇲"],["az","Azərbaycan","🇦🇿"],["eu","Euskara","🇪🇸"],["be","Беларуская","🇧🇾"],["bn","বাংলা","🇧🇩"],["bs","Bosanski","🇧🇦"],["bg","Български","🇧🇬"],["ca","Català","🇪🇸"],["zh","中文","🇨🇳"],["zh-TW","繁體中文","🇹🇼"],["hr","Hrvatski","🇭🇷"],["cs","Čeština","🇨🇿"],["da","Dansk","🇩🇰"],["nl","Nederlands","🇳🇱"],["et","Eesti","🇪🇪"],["fi","Suomi","🇫🇮"],["fr","Français","🇫🇷"],["gl","Galego","🇪🇸"],["ka","ქართული","🇬🇪"],["de","Deutsch","🇩🇪"],["el","Ελληνικά","🇬🇷"],["gu","ગુજરાતી","🇮🇳"],["he","עברית","🇮🇱"],["hi","हिन्दी","🇮🇳"],["hu","Magyar","🇭🇺"],["is","Íslenska","🇮🇸"],["id","Bahasa Indonesia","🇮🇩"],["ga","Gaeilge","🇮🇪"],["it","Italiano","🇮🇹"],["ja","日本語","🇯🇵"],["kn","ಕನ್ನಡ","🇮🇳"],["kk","Қазақша","🇰🇿"],["km","ខ្មែរ","🇰🇭"],["ko","한국어","🇰🇷"],["ky","Кыргызча","🇰🇬"],["lo","ລາວ","🇱🇦"],["lv","Latviešu","🇱🇻"],["lt","Lietuvių","🇱🇹"],["mk","Македонски","🇲🇰"],["ms","Bahasa Melayu","🇲🇾"],["ml","മലയാളം","🇮🇳"],["mr","मराठी","🇮🇳"],["mn","Монгол","🇲🇳"],["ne","नेपाली","🇳🇵"],["no","Norsk","🇳🇴"],["fa","فارسی","🇮🇷"],["pl","Polski","🇵🇱"],["pt","Português","🇵🇹"],["pa","ਪੰਜਾਬੀ","🇮🇳"],["ro","Română","🇷🇴"],["ru","Русский","🇷🇺"],["sr","Српски","🇷🇸"],["sk","Slovenčina","🇸🇰"],["sl","Slovenščina","🇸🇮"],["so","Soomaali","🇸🇴"],["es","Español","🇪🇸"],["sw","Kiswahili","🌍"],["sv","Svenska","🇸🇪"],["ta","தமிழ்","🇮🇳"],["te","తెలుగు","🇮🇳"],["th","ไทย","🇹🇭"],["tr","Türkçe","🇹🇷"],["uk","Українська","🇺🇦"],["ur","اردو","🇵🇰"],["uz","O‘zbek","🇺🇿"],["vi","Tiếng Việt","🇻🇳"],["cy","Cymraeg","🏴"],["xh","isiXhosa","🇿🇦"],["yo","Yorùbá","🇳🇬"],["zu","isiZulu","🇿🇦"],["mg","Malagasy","🇲🇬"],["tl","Tagalog","🇵🇭"],["la","Latin","🌐"],["jv","Basa Jawa","🇮🇩"],["my","မြန်မာ","🇲🇲"],["si","සිංහල","🇱🇰"],["tk","Türkmençe","🇹🇲"],["tg","Тоҷикӣ","🇹🇯"],["ps","پښتو","🇦🇫"],["ku","Kurdî","🌐"],["ha","Hausa","🇳🇬"],["ig","Igbo","🇳🇬"],["am","አማርኛ","🇪🇹"]
].map(([code, name, flag]) => ({ code, name, flag }));

const translations: Record<string, Record<string, string>> = {
  en: {
    home: "Home", notifications: "Notifications", messages: "Messages", profile: "Profile", search: "Search", create: "Create", worldFeed: "World Feed", settings: "Settings", language: "Language", appearance: "Appearance", privacy: "Privacy", security: "Security", storage: "Storage", about: "About", logout: "Log Out", logoutConfirm: "Are you sure you want to log out?", cancel: "Cancel", confirm: "Confirm", darkMode: "Dark Mode", lightMode: "Light Mode", blockedUsers: "Blocked Users", verify: "Verify Account", twoFactor: "Two-Factor Authentication", activeSessions: "Active Sessions", loginHistory: "Login History", cacheManagement: "Clear Cache", downloadData: "Download My Data", helpCenter: "Help Center", feedback: "Send Feedback", termsOfService: "Terms of Service", privacyPolicy: "Privacy Policy", appVersion: "App Version", deleteAccount: "Delete Account"
  },
  fr: {
    home: "Accueil", notifications: "Notifications", messages: "Messages", profile: "Profil", search: "Recherche", create: "Créer", worldFeed: "Fil Mondial", settings: "Paramètres", language: "Langue", appearance: "Apparence", privacy: "Confidentialité", security: "Sécurité", storage: "Stockage", about: "À propos", logout: "Déconnexion", logoutConfirm: "Voulez-vous vraiment vous déconnecter ?", cancel: "Annuler", confirm: "Confirmer", darkMode: "Mode sombre", lightMode: "Mode clair", blockedUsers: "Utilisateurs bloqués", verify: "Vérifier le compte", twoFactor: "Authentification à deux facteurs", activeSessions: "Sessions actives", loginHistory: "Historique de connexion", cacheManagement: "Vider le cache", downloadData: "Télécharger mes données", helpCenter: "Centre d'aide", feedback: "Envoyer un commentaire", termsOfService: "Conditions d'utilisation", privacyPolicy: "Politique de confidentialité", appVersion: "Version de l'application", deleteAccount: "Supprimer le compte"
  },
  es: {
    home: "Inicio", notifications: "Notificaciones", messages: "Mensajes", profile: "Perfil", search: "Buscar", create: "Crear", worldFeed: "Feed Mundial", settings: "Ajustes", language: "Idioma", appearance: "Apariencia", privacy: "Privacidad", security: "Seguridad", storage: "Almacenamiento", about: "Acerca de", logout: "Cerrar sesión", logoutConfirm: "¿Seguro que quieres cerrar sesión?", cancel: "Cancelar", confirm: "Confirmar", darkMode: "Modo oscuro", lightMode: "Modo claro", blockedUsers: "Usuarios bloqueados", verify: "Verificar cuenta", twoFactor: "Autenticación en dos pasos", activeSessions: "Sesiones activas", loginHistory: "Historial de inicio", cacheManagement: "Limpiar caché", downloadData: "Descargar mis datos", helpCenter: "Centro de ayuda", feedback: "Enviar comentarios", termsOfService: "Términos de servicio", privacyPolicy: "Política de privacidad", appVersion: "Versión de la app", deleteAccount: "Eliminar cuenta"
  }
};

export function getLang(): Lang {
  const saved = localStorage.getItem("yuniko-language");
  if (saved && availableLanguages.some((l) => l.code === saved)) return saved;
  const browser = (navigator.language || "en").toLowerCase();
  const exact = availableLanguages.find((l) => l.code.toLowerCase() === browser);
  if (exact) return exact.code;
  const base = browser.split("-")[0];
  const match = availableLanguages.find((l) => l.code.toLowerCase() === base);
  return match?.code ?? "en";
}

export function setLang(lang: Lang): void {
  if (availableLanguages.some((l) => l.code === lang)) {
    localStorage.setItem("yuniko-language", lang);
  }
}

export function t(key: string, lang: Lang = getLang()): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

// The primary navigation intentionally remains English and must not use t().
export const navigationLabels = {
  home: "Home",
  notifications: "Notifications",
  messages: "Messages",
  profile: "Profile",
  search: "Search",
  create: "Create",
} as const;

export default translations;
