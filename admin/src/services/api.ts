import axios, {
  AxiosError,
  AxiosHeaders,
  isAxiosError,
} from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { getApiBaseUrl } from '../config/env'
import type { RefreshTokenPayload } from '../types/auth'
import {
  clearStoredSession,
  getAccessTokenFromStore,
  getRefreshTokenFromStore,
  updateStoredTokens,
} from './authStorage'

type RetryableRequestConfig = AxiosRequestConfig & { _retry?: boolean }

type QueueEntry = {
  resolve: (token: string) => void
  reject: (reason: unknown) => void
}

let logoutHandler: (() => void | Promise<void>) | null = null

export function setLogoutHandler(
  handler: (() => void | Promise<void>) | null,
): void {
  logoutHandler = handler
}

let sessionRefreshedHandler: ((p: RefreshTokenPayload) => void) | null = null

export function setSessionRefreshedHandler(
  handler: ((p: RefreshTokenPayload) => void) | null,
): void {
  sessionRefreshedHandler = handler
}

let isRefreshing = false
let failedQueue: QueueEntry[] = []

function rejectQueue(reason: unknown): void {
  failedQueue.forEach((prom) => {
    prom.reject(reason)
  })
  failedQueue = []
}

function resolveQueue(token: string): void {
  failedQueue.forEach((prom) => {
    prom.resolve(token)
  })
  failedQueue = []
}

function isAuthPublicPath(config: AxiosRequestConfig): boolean {
  const path = `${config.baseURL ?? ''}${config.url ?? ''}`
  const publicPaths = [
    '/auth/login',
    '/auth/refresh',
    '/auth/activate',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
  ]
  return publicPaths.some((p) => path.includes(p))
}

const baseURL = getApiBaseUrl()

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
})

api.interceptors.request.use(async (config) => {
  const headers = AxiosHeaders.from(config.headers as AxiosHeaders | undefined)
  // Sinon axios garde le défaut application/json et Multer ne reçoit pas le fichier (400).
  if (config.data instanceof FormData) {
    headers.delete('Content-Type')
  }
  const token = getAccessTokenFromStore()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  config.headers = headers
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error)) {
      return Promise.reject(error)
    }

    const axiosError = error as AxiosError
    const originalRequest = axiosError.config as RetryableRequestConfig | undefined

    if (
      axiosError.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthPublicPath(originalRequest)
    ) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        const headers = AxiosHeaders.from(
          originalRequest.headers as AxiosHeaders | undefined,
        )
        headers.set('Authorization', `Bearer ${token}`)
        originalRequest.headers = headers
        return api(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    const refreshToken = getRefreshTokenFromStore()
    if (!refreshToken) {
      isRefreshing = false
      rejectQueue(new Error('No refresh token'))
      clearStoredSession()
      await Promise.resolve(logoutHandler?.())
      return Promise.reject(error)
    }

    try {
      const { data } = await axios.post<RefreshTokenPayload>(
        `${baseURL}/auth/refresh`,
        { refreshToken },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30_000,
          // Évite qu’un 301/302 transforme le POST en GET lors du suivi de redirection
          maxRedirects: 0,
        },
      )
      await updateStoredTokens(data.accessToken, data.refreshToken)
      sessionRefreshedHandler?.(data)
      resolveQueue(data.accessToken)

      const headers = AxiosHeaders.from(
        originalRequest.headers as AxiosHeaders | undefined,
      )
      headers.set('Authorization', `Bearer ${data.accessToken}`)
      originalRequest.headers = headers
      isRefreshing = false
      return api(originalRequest)
    } catch (refreshErr) {
      isRefreshing = false
      rejectQueue(refreshErr)
      clearStoredSession()
      await Promise.resolve(logoutHandler?.())
      return Promise.reject(refreshErr)
    }
  },
)
