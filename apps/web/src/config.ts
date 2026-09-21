// Dinamiski nosakām backend adresi:
// Ja lapa atvērta caur Cloudflare tuneli vai tīkla IP, izmantojam to pašu domēnu (caur Vite proxy),
// ja atvērts lokāli datorā — izmantojam portu 3000.
export const BACKEND_URL =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('trycloudflare.com') ||
    (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'))
    ? window.location.origin
    : import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const FALLBACK_ADMIN_KEY = 'izskaties_dzirdets_super_secret_key_2026';

export const getAdminKey = (): string => {
  if (typeof window !== 'undefined') {
    const sessionKey = sessionStorage.getItem('admin_api_key');
    if (sessionKey) return sessionKey;
  }
  return import.meta.env.VITE_ADMIN_API_KEY || FALLBACK_ADMIN_KEY;
};

export const getAdminHeaders = (): Record<string, string> => {
  const key = getAdminKey();
  return key ? { 'x-admin-key': key } : {};
};