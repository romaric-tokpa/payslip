import type { EmployeeUser } from './employees'

export type SettingsCompanyBrief = {
  id: string
  name: string
  rccm: string | null
  address: string | null
}

export type MeSettingsResponse = {
  user: EmployeeUser
  company: SettingsCompanyBrief | null
}
