import type { AuthSessionPayload, RefreshTokenPayload } from '../types/auth'
import { api } from './api'

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
  const { data } = await api.post<RefreshTokenPayload>('/auth/refresh', {
    refreshToken,
  })
  return data
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken })
}
