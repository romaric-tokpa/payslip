import { Alert, Card, Spin, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { StatCard } from '../../components/StatCard'
import * as dashboardApi from '../../services/dashboard.service'
import { adminTheme } from '../../theme/adminTheme'
import type { DashboardStats, TopUnreadRow } from '../../types/dashboard'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './dashboard.css'

const MONTH_LABELS_SHORT = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
] as const

type ChartRow = {
  label: string
  count: number
  month: number
  year: number
  isCurrent: boolean
}

function formatChartLabel(m: number): string {
  const idx = m >= 1 && m <= 12 ? m - 1 : 0
  return MONTH_LABELS_SHORT[idx]
}

type TooltipPayloadEntry = {
  value?: number
  payload?: ChartRow
}

type UploadsTooltipProps = {
  active?: boolean
  payload?: readonly TooltipPayloadEntry[]
}

function UploadsTooltip({ active, payload }: UploadsTooltipProps) {
  if (!active || payload == null || payload.length === 0) {
    return null
  }
  const item = payload[0]
  const row = item.payload
  const count = typeof item.value === 'number' ? item.value : 0
  if (row == null) {
    return null
  }
  return (
    <div className="dashboard-chart-tooltip">
      <div className="dashboard-chart-tooltip__title">
        {String(row.month).padStart(2, '0')}/{row.year}
      </div>
      <div className="dashboard-chart-tooltip__body">
        Bulletins : <strong>{count}</strong>
      </div>
    </div>
  )
}

function initials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? ''
  const b = lastName.trim()[0] ?? ''
  const pair = `${a}${b}`.toUpperCase()
  return pair.length > 0 ? pair : '?'
}

export function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const nowYm = useMemo(() => {
    const d = new Date()
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await dashboardApi.getDashboardStats()
      setStats(data)
    } catch (e) {
      const msg = getApiErrorMessage(
        e,
        'Impossible de charger le tableau de bord',
      )
      setLoadError(msg)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const chartData: ChartRow[] = useMemo(
    () =>
      stats?.monthlyUploads.map((u) => ({
        label: formatChartLabel(u.month),
        count: u.count,
        month: u.month,
        year: u.year,
        isCurrent: u.month === nowYm.m && u.year === nowYm.y,
      })) ?? [],
    [stats?.monthlyUploads, nowYm.m, nowYm.y],
  )

  const consultationBorder =
    stats != null && stats.consultationRate > 80
      ? adminTheme.green
      : adminTheme.orange

  const consultationSubtitle =
    stats != null
      ? `${stats.consultationRateDelta >= 0 ? '+' : ''}${stats.consultationRateDelta}% vs mois dernier`
      : ''

  const newEmployeesSubtitle =
    stats != null && stats.newEmployeesThisMonth > 0
      ? `+${stats.newEmployeesThisMonth} ce mois`
      : undefined

  const topUnreadFive: TopUnreadRow[] = stats?.topUnread.slice(0, 5) ?? []

  return (
    <div className="dashboard-page">
      {loadError != null && !loading ? (
        <Alert
          type="error"
          showIcon
          className="dashboard-error-alert"
          message={loadError}
          action={
            <Typography.Link onClick={() => void load()} role="button">
              Réessayer
            </Typography.Link>
          }
        />
      ) : null}

      <Spin spinning={loading} size="large" className="dashboard-spin-wrap">
        <div className="dashboard-spin-inner">
          {stats != null ? (
            <>
              <div className="dashboard-stat-grid">
                <StatCard
                  label="Collaborateurs actifs"
                  value={stats.activeEmployees}
                  borderColor={adminTheme.teal}
                  subtitle={newEmployeesSubtitle}
                  subtitleColor={adminTheme.green}
                />
                <StatCard
                  label="Bulletins ce mois"
                  value={stats.payslipsThisMonth}
                  borderColor={adminTheme.blue}
                  subtitle={`sur ${stats.totalEmployees} attendus`}
                  subtitleColor={adminTheme.blue}
                />
                <StatCard
                  label="Taux de consultation"
                  value={`${stats.consultationRate}%`}
                  borderColor={consultationBorder}
                  subtitle={consultationSubtitle}
                  subtitleColor={consultationBorder}
                />
                <StatCard
                  label="Non consultés"
                  value={stats.unreadPayslips}
                  borderColor={adminTheme.orange}
                  subtitle={
                    stats.unreadPayslips > 0 ? 'Rappel recommandé' : undefined
                  }
                  subtitleColor={adminTheme.orange}
                />
              </div>

              <div className="dashboard-lower-grid">
                <Card
                  className="dashboard-white-card"
                  title={
                    <span className="dashboard-card-title">
                      Distribution mensuelle
                    </span>
                  }
                  styles={{ body: { paddingTop: 8 } }}
                >
                  <div className="dashboard-chart-wrap">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        data={chartData}
                        margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: adminTheme.gray }}
                          interval={0}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 12, fill: adminTheme.gray }}
                        />
                        <Tooltip content={<UploadsTooltip />} />
                        <Bar
                          dataKey="count"
                          radius={[4, 4, 0, 0]}
                          name="Bulletins"
                        >
                          {chartData.map((entry) => (
                            <Cell
                              key={`${entry.year}-${entry.month}`}
                              fill={
                                entry.isCurrent
                                  ? '#0F5C5E'
                                  : '#E8F5F5'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card
                  className="dashboard-white-card dashboard-unread-card"
                  title={
                    <div className="dashboard-unread-card__head">
                      <span className="dashboard-card-title">Non consultés</span>
                      <Link
                        to="/payslips"
                        className="dashboard-unread-see-all"
                      >
                        Voir tout
                      </Link>
                    </div>
                  }
                  styles={{ body: { paddingTop: 8 } }}
                >
                  {topUnreadFive.length === 0 ? (
                    <Typography.Text type="secondary">
                      Aucun bulletin non consulté à signaler
                    </Typography.Text>
                  ) : (
                    <ul className="dashboard-unread-list">
                      {topUnreadFive.map((row) => (
                        <li key={row.userId} className="dashboard-unread-item">
                          <div className="dashboard-unread-avatar">
                            {initials(row.firstName, row.lastName)}
                          </div>
                          <div className="dashboard-unread-meta">
                            <div className="dashboard-unread-name">
                              {row.lastName} {row.firstName}
                            </div>
                            <div className="dashboard-unread-dept">
                              {row.department ?? '—'}
                            </div>
                          </div>
                          <span className="dashboard-unread-badge">
                            {row.lastPayslipPeriod}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </>
          ) : loadError != null ? null : !loading ? (
            <Typography.Text type="secondary">
              Aucune donnée à afficher.
            </Typography.Text>
          ) : null}
        </div>
      </Spin>
    </div>
  )
}
