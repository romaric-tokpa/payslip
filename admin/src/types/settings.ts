import type { EmployeeUser } from './employees'

export type SettingsCompanyBrief = {
  id: string
  name: string
  rccm: string | null
  phone: string | null
  address: string | null
  requireSignature: boolean
}

export type MeSettingsResponse = {
  user: EmployeeUser
  company: SettingsCompanyBrief | null
}
