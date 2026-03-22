import { api } from './api'
import type { User } from '../types/auth'
import type { EmployeeUser } from '../types/employees'
import type { MeSettingsResponse, SettingsCompanyBrief } from '../types/settings'

export async function getMe(): Promise<MeSettingsResponse> {
  const { data } = await api.get<MeSettingsResponse>('/users/me')
  return data
}

export type UpdateProfilePayload = {
  firstName?: string
  lastName?: string
  email?: string
  department?: string
  position?: string
}

export async function updateMe(
  body: UpdateProfilePayload,
): Promise<MeSettingsResponse> {
  const { data } = await api.patch<MeSettingsResponse>('/users/me', body)
  return data
}

export type UpdateCompanyPayload = {
  name?: string
  rccm?: string
  phone?: string
  address?: string
  requireSignature?: boolean
}

export async function updateMyCompany(
  body: UpdateCompanyPayload,
): Promise<MeSettingsResponse> {
  const { data } = await api.patch<MeSettingsResponse>('/companies/me', body)
  return data
}

/** Réduit le profil API vers l’objet stocké en session (JWT claims / menu). */
export function meUserToSessionUser(
  u: EmployeeUser,
  company?: SettingsCompanyBrief | null,
): User {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    companyId: u.companyId,
    companyName: company?.name,
  }
}
