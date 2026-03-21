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
