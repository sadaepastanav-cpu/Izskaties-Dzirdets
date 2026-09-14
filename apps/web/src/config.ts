// Backend URL noteikšana: vispirms pārbauda .env mainīgo, tad pielāgojas videi
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined'
    ? window.location.port === '5173' && window.location.hostname === 'localhost'
      ? `http://${window.location.hostname}:3000`
      : `${window.location.protocol}//${window.location.host}`
    : 'http://localhost:3000');

// Administratora atslēga no .env vai noklusējuma
export const ADMIN_API_KEY =
  import.meta.env.VITE_ADMIN_API_KEY || 'izskaties_dzirdets_super_secret_key_2026';

// Ērts palīgs pieprasījumu galvenēm
export const getAdminHeaders = () => ({
  'Content-Type': 'application/json',
  'x-admin-key': ADMIN_API_KEY
});