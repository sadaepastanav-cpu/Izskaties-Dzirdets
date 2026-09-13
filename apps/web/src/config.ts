export const BACKEND_URL =
  window.location.port === '5173' && window.location.hostname === 'localhost'
    ? `http://${window.location.hostname}:3000`
    : `${window.location.protocol}//${window.location.host}`;