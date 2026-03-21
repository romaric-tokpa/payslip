export type UserRole = 'SUPER_ADMIN' | 'RH_ADMIN' | 'EMPLOYEE'

export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  companyId: string | null
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
