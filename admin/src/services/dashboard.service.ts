import { api } from './api'
import type { DashboardStats } from '../types/dashboard'

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/dashboard/stats')
  return data
}

export async function remindUnreadCurrentMonth(): Promise<{ reminded: number }> {
  const { data } = await api.post<{ reminded: number }>(
    '/dashboard/remind-unread',
  )
  return data
}
