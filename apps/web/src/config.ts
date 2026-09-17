export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Rezerves atslēga lokālajai videi (sakrīt ar servera noklusējumu)
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