/**
 * URL de base de l’API (suffixe `/api/v1`).
 *
 * En dev, on pointe par défaut vers Nest sur le port **3000** (requêtes cross-origin ;
 * le backend doit autoriser l’origine Vite, ex. `http://localhost:5173` — voir `CORS_ORIGINS`).
 * Le proxy Vite (`/api` → 3000) reste utilisable si vous définissez
 * `VITE_API_BASE_URL=/api/v1` dans `.env`.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }
  if (import.meta.env.PROD) {
    return '/api/v1';
  }
  return 'http://localhost:3000/api/v1';
}
