import { api } from './api'
import type { EmployeeUser } from '../types/employees'
import type { MeSettingsResponse } from '../types/settings'

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
  address?: string
}

export async function updateMyCompany(
  body: UpdateCompanyPayload,
): Promise<MeSettingsResponse> {
  const { data } = await api.patch<MeSettingsResponse>('/companies/me', body)
  return data
}

/** Réduit le profil API vers l’objet stocké en session (JWT claims / menu). */
export function meUserToSessionUser(u: EmployeeUser): {
  id: string
  email: string
  firstName: string
  lastName: string
  role: EmployeeUser['role']
  companyId: string | null
} {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    companyId: u.companyId,
  }
}
