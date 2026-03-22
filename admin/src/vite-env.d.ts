/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_LANDING_IOS_APP_URL?: string
  readonly VITE_LANDING_ANDROID_APP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
