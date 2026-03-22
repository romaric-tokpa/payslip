export type UserRole = 'SUPER_ADMIN' | 'RH_ADMIN' | 'EMPLOYEE'

export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  companyId: string | null
  /** Présent après inscription (réponse register). */
  companyName?: string | null
  mustChangePassword?: boolean
  /** JWT d’impersonation (debug client). */
  impersonatedBy?: string
}

export type AuthSessionPayload = {
  user: User
  accessToken: string
  refreshToken: string
}

export type RefreshTokenPayload = {
  accessToken: string
  refreshToken: string
}
