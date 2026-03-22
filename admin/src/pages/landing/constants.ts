/** Logos wordmark (fichiers dans `public/landing/`) */
export const LANDING_LOGO_HORIZONTAL = `${import.meta.env.BASE_URL}landing/logo_horizontal.svg`
export const LANDING_LOGO_HORIZONTAL_DARK = `${import.meta.env.BASE_URL}landing/logo_horizontal_dark.svg`

export const LANDING_BADGE_APP_STORE = `${import.meta.env.BASE_URL}landing/badge-app-store.svg`
export const LANDING_BADGE_GOOGLE_PLAY = `${import.meta.env.BASE_URL}landing/badge-google-play.svg`

const trimEnv = (v: string | undefined): string | undefined => {
  const s = v?.trim()
  return s ? s : undefined
}

/** Liens App Store / Play Store (définir `VITE_LANDING_IOS_APP_URL` et `VITE_LANDING_ANDROID_APP_URL` dans `.env`). */
export const LANDING_APP_STORE_URL =
  trimEnv(import.meta.env.VITE_LANDING_IOS_APP_URL) ??
  'https://apps.apple.com/search?term=PaySlip%20Manager'

export const LANDING_GOOGLE_PLAY_URL =
  trimEnv(import.meta.env.VITE_LANDING_ANDROID_APP_URL) ??
  'https://play.google.com/store/search?q=PaySlip+Manager&c=apps'

export function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

export function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
