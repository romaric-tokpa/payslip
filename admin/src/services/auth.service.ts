import type { AuthSessionPayload, RefreshTokenPayload } from '../types/auth'
import { api } from './api'

/** Évite deux POST /refresh parallèles avec le même jeton (React StrictMode, onglets). */
const refreshInFlight = new Map<string, Promise<RefreshTokenPayload>>()

export async function login(
  email: string,
  password: string,
): Promise<AuthSessionPayload> {
  const { data } = await api.post<AuthSessionPayload>('/auth/login', {
    email,
    password,
  })
  return data
}

export async function refreshTokens(
  refreshToken: string,
): Promise<RefreshTokenPayload> {
  const pending = refreshInFlight.get(refreshToken)
  if (pending) {
    return pending
  }
  const promise = api
    .post<RefreshTokenPayload>('/auth/refresh', { refreshToken })
    .then((res) => res.data)
    .finally(() => {
      refreshInFlight.delete(refreshToken)
    })
  refreshInFlight.set(refreshToken, promise)
  return promise
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken })
}

export async function registerAccount(body: {
  email: string
  password: string
  firstName: string
  lastName: string
  referentJobTitle: string
  companyName: string
  companyPhone: string
  rccm?: string
}): Promise<AuthSessionPayload> {
  const { data } = await api.post<AuthSessionPayload>('/auth/register', body)
  return data
}

export type ForgotPasswordResponse = {
  message: string
  resetToken?: string
  resetUrl?: string
}

export async function forgotPassword(
  email: string,
): Promise<ForgotPasswordResponse> {
  const { data } = await api.post<ForgotPasswordResponse>(
    '/auth/forgot-password',
    { email },
  )
  return data
}

export async function resetPasswordWithToken(body: {
  resetToken: string
  newPassword: string
}): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(
    '/auth/reset-password',
    body,
  )
  return data
}

export async function changePassword(body: {
  currentPassword: string
  newPassword: string
}): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(
    '/auth/change-password',
    body,
  )
  return data
}

export type AuthSessionRow = {
  id: string
  deviceInfo: string | null
  ipAddress: string | null
  createdAt: string
  expiresAt: string
}

export async function listAuthSessions(): Promise<AuthSessionRow[]> {
  const { data } = await api.get<AuthSessionRow[]>('/auth/sessions')
  return data
}

export async function revokeAuthSession(id: string): Promise<void> {
  await api.delete(`/auth/sessions/${encodeURIComponent(id)}`)
}
