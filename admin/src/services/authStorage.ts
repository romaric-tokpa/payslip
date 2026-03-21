import type { User } from '../types/auth'
import { STORAGE_KEYS } from '../constants/storageKeys'

export type StoredSession = {
  accessToken: string
  refreshToken: string
  user: User
}

export function saveStoredSession(session: StoredSession): void {
  localStorage.setItem(STORAGE_KEYS.accessToken, session.accessToken)
  localStorage.setItem(STORAGE_KEYS.refreshToken, session.refreshToken)
  localStorage.setItem(STORAGE_KEYS.userJson, JSON.stringify(session.user))
}

export function updateStoredTokens(
  accessToken: string,
  refreshToken: string,
): void {
  localStorage.setItem(STORAGE_KEYS.accessToken, accessToken)
  localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken)
}

export function loadStoredSession(): StoredSession | null {
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken)
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
  const userJson = localStorage.getItem(STORAGE_KEYS.userJson)
  if (!accessToken || !refreshToken || !userJson) {
    return null
  }
  try {
    const user = JSON.parse(userJson) as User
    if (
      typeof user.id !== 'string' ||
      typeof user.email !== 'string' ||
      typeof user.firstName !== 'string' ||
      typeof user.lastName !== 'string' ||
      typeof user.role !== 'string'
    ) {
      return null
    }
    return { accessToken, refreshToken, user }
  } catch {
    return null
  }
}

export function clearStoredSession(): void {
  localStorage.removeItem(STORAGE_KEYS.accessToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
  localStorage.removeItem(STORAGE_KEYS.userJson)
}

export function getAccessTokenFromStore(): string | null {
  return localStorage.getItem(STORAGE_KEYS.accessToken)
}

export function getRefreshTokenFromStore(): string | null {
  return localStorage.getItem(STORAGE_KEYS.refreshToken)
}
