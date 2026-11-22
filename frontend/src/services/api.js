import axios from 'axios';

const TOKEN_KEY = 'civiclens_token';

// In development the Vite server proxies /api to http://127.0.0.1:8000.
// Set VITE_API_URL (e.g. http://127.0.0.1:8000) to call the backend directly.
const baseURL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const api = aaxios.create({ baseURL, timeout: 60000 });

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t) => {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  },
};

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.includes('/api/auth/login') && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Turn any API error into a short human-readable message. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (err.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (!err.response) return 'Cannot reach the CivicLens server. Make sure the backend is running on port 8000.';
  const d = err.response.data?.detail;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object' && d.message) return d.message;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  return fallback;
}
