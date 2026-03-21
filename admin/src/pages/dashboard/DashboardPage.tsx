import {
  EyeOutlined,
  FileProtectOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { App, Button, Spin, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import * as dashboardApi from '../../services/dashboard.service'
import type { DashboardStats, TopUnreadRow } from '../../types/dashboard'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './dashboard.css'

const { Title } = Typography

const TEAL = '#0F5C5E'
const BLUE = '#1677ff'

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

type KpiCardProps = {
  label: string
  value: string | number
  icon: ReactNode
  accentColor: string
}

function KpiCard({ label, value, icon, accentColor }: KpiCardProps) {
  return (
    <div
      className="dashboard-kpi-card"
      style={{ borderLeftColor: accentColor }}
    >
      <div className="dashboard-kpi-card__head">
        <span aria-hidden style={{ color: accentColor, fontSize: 22 }}>
          {icon}
        </span>
      </div>
      <div className="dashboard-kpi-card__value">{value}</div>
      <div className="dashboard-kpi-card__label">{label}</div>
    </div>
  )
}

function formatChartLabel(m: number, y: number): string {
  const idx = m >= 1 && m <= 12 ? m - 1 : 0
  return `${MONTH_LABELS_SHORT[idx]} ${y}`
}

type ChartRow = { label: string; count: number; month: number; year: number }

type UploadsTooltipProps = {
  active?: boolean
  payload?: ReadonlyArray<{
    value?: number
    payload?: unknown
  }>
}

function UploadsTooltip({ active, payload }: UploadsTooltipProps) {
  if (!active || payload == null || payload.length === 0) {
    return null
  }
  const item = payload[0]
  const row = item?.payload as ChartRow | undefined
  const count = typeof item?.value === 'number' ? item.value : 0
  if (row == null) {
    return null
  }
  return (
    <div
      style={{
        background: '#fff',
        padding: '8px 12px',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {String(row.month).padStart(2, '0')}/{row.year}
      </div>
      <div style={{ color: 'rgba(0,0,0,0.65)' }}>
        Bulletins : <strong>{count}</strong>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await dashboardApi.getDashboardStats()
        if (!cancelled) {
          setStats(data)
        }
      } catch (e) {
        if (!cancelled) {
          message.error(
            getApiErrorMessage(e, 'Impossible de charger le tableau de bord'),
          )
          setStats(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [message])

  const chartData: ChartRow[] =
    stats?.monthlyUploads.map((u) => ({
      label: formatChartLabel(u.month, u.year),
      count: u.count,
      month: u.month,
      year: u.year,
    })) ?? []

  const consultationAccent =
    stats != null && stats.consultationRate > 80 ? '#52c41a' : '#fa8c16'

  const unreadAccent =
    stats != null && stats.unreadPayslips > 0 ? '#ff4d4f' : '#bfbfbf'

  const columns: ColumnsType<TopUnreadRow> = [
    {
      title: 'Nom',
      key: 'name',
      render: (_: unknown, row) =>
        `${row.lastName} ${row.firstName}`.trim(),
    },
    {
      title: 'Matricule',
      dataIndex: 'employeeId',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Département',
      dataIndex: 'department',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Période',
      dataIndex: 'lastPayslipPeriod',
    },
    {
      title: 'Statut',
      key: 'statut',
      render: () => <Tag color="error">Non lu</Tag>,
    },
    {
      title: '',
      key: 'remind',
      width: 160,
      render: (_: unknown, row) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            message.info(
              `Rappel pour ${row.firstName} ${row.lastName} — prévu sprint 6`,
            )
          }}
        >
          Envoyer un rappel
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        Tableau de bord
      </Title>
      <Spin
        spinning={loading}
        classNames={{ root: 'dashboard-spin-wrap' }}
        size="large"
      >
        {stats != null ? (
          <>
            <div className="dashboard-kpi-grid">
              <KpiCard
                label="Collaborateurs actifs"
                value={`${stats.activeEmployees} / ${stats.totalEmployees}`}
                icon={<TeamOutlined />}
                accentColor={TEAL}
              />
              <KpiCard
                label="Bulletins ce mois"
                value={stats.payslipsThisMonth}
                icon={<FileProtectOutlined />}
                accentColor={BLUE}
              />
              <KpiCard
                label="Taux de consultation"
                value={`${stats.consultationRate} %`}
                icon={<EyeOutlined />}
                accentColor={consultationAccent}
              />
              <KpiCard
                label="Non consultés"
                value={stats.unreadPayslips}
                icon={<WarningOutlined />}
                accentColor={unreadAccent}
              />
            </div>

            <div className="dashboard-chart-card">
              <h4 className="dashboard-chart-title">
                Bulletins téléversés (12 derniers mois)
              </h4>
              <div className="dashboard-chart-wrap">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<UploadsTooltip />} />
                    <Bar
                      dataKey="count"
                      fill={TEAL}
                      radius={[4, 4, 0, 0]}
                      name="Bulletins"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-table-card">
              <h4 className="dashboard-table-title">
                Bulletins non consultés (dernier bulletin par collaborateur)
              </h4>
              <Table<TopUnreadRow>
                rowKey="userId"
                size="middle"
                pagination={false}
                columns={columns}
                dataSource={stats.topUnread}
                locale={{ emptyText: 'Aucun bulletin non consulté à signaler' }}
              />
            </div>
          </>
        ) : loading ? null : (
          <Typography.Text type="secondary">
            Aucune donnée à afficher.
          </Typography.Text>
        )}
      </Spin>
    </div>
  )
}
