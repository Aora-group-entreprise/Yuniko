export type Lang = "en" | "fr" | "es";

export type LanguageOption = { code: Lang; name: string; flag: string };

export const availableLanguages: LanguageOption[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
];

const translations: Record<Lang, Record<string, string>> = {
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
  const saved = localStorage.getItem("yuniko-language") as Lang | null;
  if (saved && translations[saved]) return saved;
  const browser = (navigator.language || "en").split("-")[0] as Lang;
  return translations[browser] ? browser : "en";
}

export function setLang(lang: Lang): void {
  localStorage.setItem("yuniko-language", lang);
}

export function t(key: string, lang: Lang = getLang()): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

export default translations;
