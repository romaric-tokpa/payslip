import { api } from './api'
import type { DashboardStats } from '../types/dashboard'

export type DashboardStatsQuery =
  | { scope: 'month'; month: number; year: number }
  | { scope: 'year'; year: number }

function normalizeMonthYear(month: number, year: number): {
  month: number
  year: number
} {
  const now = new Date()
  let m = Math.trunc(Number(month))
  let y = Math.trunc(Number(year))
  if (!Number.isFinite(m) || m < 1 || m > 12) {
    m = now.getUTCMonth() + 1
  }
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    y = now.getUTCFullYear()
  }
  return { month: m, year: y }
}

function normalizeYear(year: number): number {
  const now = new Date()
  const y = Math.trunc(Number(year))
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    return now.getUTCFullYear()
  }
  return y
}

export async function getDashboardStats(
  query: DashboardStatsQuery,
): Promise<DashboardStats> {
  if (query.scope === 'year') {
    const year = normalizeYear(query.year)
    const { data } = await api.get<DashboardStats>('/dashboard/stats', {
      params: { year },
    })
    return data
  }
  const { month, year } = normalizeMonthYear(query.month, query.year)
  const { data } = await api.get<DashboardStats>('/dashboard/stats', {
    params: { month, year },
  })
  return data
}

export async function remindUnreadCurrentMonth(): Promise<{ reminded: number }> {
  const { data } = await api.post<{ reminded: number }>(
    '/dashboard/remind-unread',
  )
  return data
}
