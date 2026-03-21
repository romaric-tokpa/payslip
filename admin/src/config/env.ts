/** En dev, Vite proxy : `/api` → `http://localhost:3000` (voir vite.config.ts). */
export function getApiBaseUrl(): string {
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
  }
  return '/api/v1'
}
