/**
 * URL de base de l’API (suffixe `/api/v1`).
 *
 * En dev, si la page est ouverte via l’**IP du LAN** (ex. `http://192.168.x.x:5173`),
 * `http://localhost:3000` ciblerait la machine **cliente**, pas le Mac — d’où « Network error ».
 * On utilise alors le **proxy Vite** (`/api` → localhost:3000 sur le serveur de dev).
 *
 * Surcharge explicite : `VITE_API_BASE_URL=/api/v1` ou `http://localhost:3000/api/v1`.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  if (import.meta.env.PROD) {
    return '/api/v1';
  }
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h !== 'localhost' && h !== '127.0.0.1') {
      return '/api/v1';
    }
  }
  return 'http://localhost:3000/api/v1';
}
