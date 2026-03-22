import {
  CalendarOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Progress,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { KpiCard } from '../../components/KpiCard'
import { ADMIN_BASE } from '../../constants/adminRoutes'
import { useAuth } from '../../contexts/AuthContext'
import * as dashboardApi from '../../services/dashboard.service'
import { adminTheme } from '../../theme/adminTheme'
import type {
  DashboardStats,
  ExpiringContractDashboardRow,
  UnreadEmployeeMonthRow,
} from '../../types/dashboard'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { isOnboardingComplete, OnboardingGuide } from './OnboardingGuide'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './dashboard.css'

dayjs.extend(relativeTime)
dayjs.locale('fr')

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

function consultationRateColor(rate: number): string {
  if (rate >= 80) {
    return '#27AE60'
  }
  if (rate >= 50) {
    return '#F28C28'
  }
  return '#E24B4A'
}

function barColorForRate(rate: number): string {
  return consultationRateColor(rate)
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? ''
  const b = parts[parts.length - 1]?.[0] ?? ''
  const pair = `${a}${b}`.toUpperCase()
  return pair.length > 0 ? pair : '?'
}

export function DashboardPage() {
  const { message } = App.useApp()
  const { isLoading: authLoading, isAuthenticated, accessToken } = useAuth()
  const cddRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [remindLoading, setRemindLoading] = useState(false)

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
    if (authLoading || !isAuthenticated || !accessToken) {
      return
    }
    void load()
  }, [authLoading, isAuthenticated, accessToken, load])

  const handleRemindAll = useCallback(async () => {
    setRemindLoading(true)
    try {
      const r = await dashboardApi.remindUnreadCurrentMonth()
      message.success(`${r.reminded} notification(s) envoyée(s)`)
      await load()
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Relance impossible'))
    } finally {
      setRemindLoading(false)
    }
  }, [load, message])

  const consultationChartData = useMemo(() => {
    if (!stats?.charts.consultationByMonth?.length) {
      return []
    }
    return stats.charts.consultationByMonth.map((item) => ({
      monthKey: item.month,
      month: item.month.length >= 7 ? item.month.slice(5) : item.month,
      rate: item.rate,
      total: item.total,
      read: item.read,
    }))
  }, [stats?.charts.consultationByMonth])

  const departmentChartData = useMemo(() => {
    if (!stats?.charts.consultationByDepartment?.length) {
      return []
    }
    return [...stats.charts.consultationByDepartment]
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 8)
  }, [stats?.charts.consultationByDepartment])

  const currentMonthLabel = useMemo(() => {
    if (!stats) {
      return ''
    }
    const m = stats.currentMonth.month
    const label = MONTH_LABELS_SHORT[m - 1] ?? String(m)
    return `${label} ${stats.currentMonth.year}`
  }, [stats])

  const signaturePeriodLabel =
    stats != null
      ? `${MONTH_LABELS_SHORT[stats.signaturePeriodMonth - 1] ?? ''} ${stats.signaturePeriodYear}`
      : ''

  const unreadColumns: ColumnsType<UnreadEmployeeMonthRow> = useMemo(
    () => [
      {
        title: 'Collaborateur',
        key: 'name',
        render: (_, record) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: '#FEF3E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 600,
                color: '#F28C28',
              }}
            >
              {initialsFromName(record.name)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{record.name}</div>
              <div style={{ fontSize: 11, color: '#BDC3C7' }}>
                {record.employeeId?.trim() || '—'}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: 'Département',
        dataIndex: 'department',
        key: 'dept',
        width: 120,
        render: (v: string | null) => v || '—',
      },
      {
        title: 'Distribué',
        dataIndex: 'distributedAt',
        key: 'dist',
        width: 110,
        render: (d: string) => dayjs(d).fromNow(),
      },
    ],
    [],
  )

  const expiringColumns: ColumnsType<ExpiringContractDashboardRow> = useMemo(
    () => [
      {
        title: 'Collaborateur',
        key: 'name',
        render: (_, r) => (
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              {r.firstName} {r.lastName}
            </div>
            <div style={{ fontSize: 11, color: '#BDC3C7' }}>
              {r.employeeId?.trim() || '—'}
            </div>
          </div>
        ),
      },
      {
        title: 'Département',
        key: 'dept',
        width: 120,
        render: (_, r) => r.departmentLabel || '—',
      },
      {
        title: 'Échéance',
        dataIndex: 'contractEndDate',
        key: 'end',
        width: 120,
        render: (date: string) => {
          const days = dayjs(date).diff(dayjs(), 'day')
          const color =
            days <= 7 ? '#E24B4A' : days <= 14 ? '#F28C28' : '#7F8C8D'
          return (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color }}>
                {dayjs(date).format('DD/MM/YYYY')}
              </div>
              <div style={{ fontSize: 11, color }}>dans {days} j.</div>
            </div>
          )
        },
      },
    ],
    [],
  )

  const recentColumns = useMemo<
    ColumnsType<DashboardStats['recentPayslips'][0]>
  >(
    () => [
      {
        title: 'Collaborateur',
        key: 'user',
        render: (_, r) =>
          `${r.user.firstName} ${r.user.lastName} (${r.user.employeeId?.trim() || '—'})`,
      },
      {
        title: 'Période',
        key: 'period',
        width: 100,
        render: (_, r) =>
          `${String(r.periodMonth).padStart(2, '0')}/${r.periodYear}`,
      },
      {
        title: 'Déposé le',
        dataIndex: 'uploadedAt',
        key: 'up',
        width: 150,
        render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm'),
      },
      {
        title: 'Statut',
        key: 'status',
        width: 160,
        render: (_, r) => (
          <Space size={6} wrap>
            <Tag color={r.isRead ? 'green' : 'orange'}>
              {r.isRead ? 'Consulté' : 'Non lu'}
            </Tag>
            {r.isSigned ? <Tag color="blue">Signé</Tag> : null}
          </Space>
        ),
      },
    ],
    [],
  )

  const todayLabel = useMemo(
    () =>
      dayjs().format('dddd D MMMM YYYY').replace(/^\w/, (c) => c.toUpperCase()),
    [],
  )

  const expiringTotal = stats?.expiringContracts.length ?? 0

  return (
    <div className="dashboard-page">
      <header className="dashboard-intro" aria-label="Date du jour">
        <span className="dashboard-intro__date">{todayLabel}</span>
      </header>

      {loadError != null && !loading ? (
        <Alert
          type="error"
          showIcon
          className="dashboard-error-alert"
          title={loadError}
          action={
            <Typography.Link onClick={() => void load()} role="button">
              Réessayer
            </Typography.Link>
          }
        />
      ) : null}

      <Spin spinning={loading} size="large" className="dashboard-spin-wrap">
        <div className="dashboard-spin-inner">
          {stats != null && !isOnboardingComplete(stats) ? (
            <OnboardingGuide stats={stats} />
          ) : stats != null ? (
            <>
              {expiringTotal > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  className="dashboard-alert-expiring"
                  title={`${expiringTotal} contrat(s) arrivent à échéance dans les 30 prochains jours`}
                  action={
                    <Button
                      size="small"
                      type="primary"
                      onClick={() =>
                        cddRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      }
                    >
                      Voir les échéances
                    </Button>
                  }
                />
              ) : null}

              <div className="dashboard-kpi-grid">
                <KpiCard
                  label="Collaborateurs actifs"
                  value={stats.kpi.activeEmployeesStrict}
                  suffix={`/ ${stats.kpi.totalEmployees} total`}
                  trend={stats.trends.employeesDelta}
                  trendLabel="ce mois vs mois dernier"
                />
                <KpiCard
                  label="Bulletins distribués"
                  value={stats.currentMonth.payslipsDistributed}
                  suffix={`ce mois (${currentMonthLabel})`}
                  trend={stats.trends.payslipsDelta}
                  trendLabel="vs mois dernier"
                />
                <KpiCard
                  label="Taux de consultation"
                  value={`${stats.currentMonth.consultationRate}%`}
                  valueColor={consultationRateColor(
                    stats.currentMonth.consultationRate,
                  )}
                  trend={stats.trends.consultationRateDelta}
                  trendSuffix="%"
                  trendLabel="vs mois dernier"
                />
                <KpiCard
                  label="Alertes contrats"
                  value={expiringTotal}
                  suffix="sous 30 j."
                  valueColor={expiringTotal > 0 ? '#E24B4A' : '#BDC3C7'}
                  onClick={() =>
                    cddRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }
                />
              </div>

              <Card
                className="dashboard-white-card dashboard-signature-feature-card"
                style={{ marginTop: 16, marginBottom: 0 }}
                title={
                  <span className="dashboard-card-title">
                    <SafetyCertificateOutlined
                      style={{ marginRight: 8, color: adminTheme.teal }}
                    />
                    Signature électronique des bulletins
                  </span>
                }
              >
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: 12, maxWidth: 720 }}
                >
                  Preuve d’accusé de réception : horodatage, empreinte du PDF,
                  code de vérification. Les collaborateurs signent depuis l’app
                  mobile.
                </Typography.Paragraph>
                <Space wrap size="middle" style={{ marginBottom: 16 }}>
                  <Link
                    to={`${ADMIN_BASE}/payslips`}
                    state={{ tab: 'signatures' }}
                    className="dashboard-signature-widget__link"
                  >
                    Suivi & relances
                  </Link>
                  <Typography.Text type="secondary">·</Typography.Text>
                  <Link to="/verify" className="dashboard-signature-widget__link">
                    Vérification publique
                  </Link>
                  <Typography.Text type="secondary">·</Typography.Text>
                  <Link
                    to={`${ADMIN_BASE}/settings`}
                    className="dashboard-signature-widget__link"
                  >
                    Paramètres entreprise
                  </Link>
                </Space>
                {stats.requireSignature ? (
                  stats.signaturePeriodTotal > 0 ? (
                    <div className="dashboard-signature-widget__row">
                      <Progress
                        type="circle"
                        percent={
                          stats.signatureRateCurrentMonth == null
                            ? 0
                            : stats.signatureRateCurrentMonth
                        }
                        strokeColor={adminTheme.teal}
                        format={() =>
                          stats.signatureRateCurrentMonth == null
                            ? '—'
                            : `${stats.signatureRateCurrentMonth}%`
                        }
                      />
                      <div>
                        <Typography.Text strong>
                          Période {signaturePeriodLabel}
                        </Typography.Text>
                        <div style={{ marginTop: 6 }}>
                          <Typography.Text type="secondary">
                            {stats.signaturePeriodSigned} /{' '}
                            {stats.signaturePeriodTotal} signé(s)
                          </Typography.Text>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Alert
                      type="info"
                      showIcon
                      title="Aucun bulletin sur cette période"
                    />
                  )
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    title="Option désactivée"
                    description="Activez l’exigence de signature dans Paramètres."
                  />
                )}
              </Card>

              <div className="dashboard-charts-grid">
                <div className="dashboard-chart-panel">
                  <div className="dashboard-chart-panel__head">
                    <div>
                      <div className="dashboard-chart-panel__title">
                        Taux de consultation
                      </div>
                      <div className="dashboard-chart-panel__subtitle">
                        12 derniers mois (périodes de paie)
                      </div>
                    </div>
                    <div className="dashboard-chart-panel__kpi">
                      {stats.currentMonth.consultationRate}%
                    </div>
                  </div>
                  <div className="dashboard-recharts-box dashboard-recharts-box--220">
                    <ResponsiveContainer width="100%" height={220} minWidth={0}>
                      <AreaChart
                        data={consultationChartData}
                        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="dashboardConsultationGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#0F5C5E"
                              stopOpacity={0.15}
                            />
                            <stop
                              offset="100%"
                              stopColor="#0F5C5E"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#F0F0EE"
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12, fill: '#BDC3C7' }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 12, fill: '#BDC3C7' }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          formatter={(value, name) => {
                            const n =
                              typeof value === 'number'
                                ? value
                                : Number(value ?? 0)
                            const key = String(name)
                            if (key === 'rate') {
                              return [`${n}%`, 'Taux']
                            }
                            if (key === 'total') {
                              return [n, 'Total bulletins']
                            }
                            return [n, 'Consultés']
                          }}
                          labelFormatter={(_, payload) => {
                            const m = payload?.[0]?.payload?.monthKey
                            return typeof m === 'string' ? m : ''
                          }}
                          contentStyle={{
                            borderRadius: 10,
                            border: '0.5px solid #E8E8E8',
                            fontSize: 12,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="rate"
                          stroke="#0F5C5E"
                          strokeWidth={2.5}
                          fill="url(#dashboardConsultationGrad)"
                          dot={{ fill: '#0F5C5E', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="dashboard-chart-panel">
                  <div className="dashboard-chart-panel__title">
                    Par département
                  </div>
                  <div className="dashboard-chart-panel__subtitle dashboard-chart-panel__subtitle--mb">
                    Mois en cours — tri par taux croissant
                  </div>
                  <div className="dashboard-recharts-box dashboard-recharts-box--220">
                    <ResponsiveContainer width="100%" height={220} minWidth={0}>
                      <BarChart
                        data={departmentChartData}
                        layout="vertical"
                        margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#F0F0EE"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#BDC3C7' }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          type="category"
                          dataKey="departmentName"
                          width={118}
                          tick={{ fontSize: 11, fill: '#7F8C8D' }}
                        />
                        <Tooltip
                          formatter={(value) => {
                            const n =
                              typeof value === 'number'
                                ? value
                                : Number(value ?? 0)
                            return [`${n}%`, 'Taux']
                          }}
                          contentStyle={{
                            borderRadius: 10,
                            border: '0.5px solid #E8E8E8',
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="rate"
                          radius={[0, 6, 6, 0]}
                          barSize={18}
                        >
                          {departmentChartData.map((entry, index) => (
                            <Cell
                              key={entry.departmentId ?? index}
                              fill={barColorForRate(entry.rate)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="dashboard-tables-grid">
                <div className="dashboard-table-panel">
                  <div className="dashboard-table-panel__head">
                    <div>
                      <div className="dashboard-chart-panel__title">
                        Non consultés
                      </div>
                      <div className="dashboard-chart-panel__subtitle">
                        {stats.unreadEmployeesThisMonth.length} collaborateur(s) —
                        {currentMonthLabel}
                      </div>
                    </div>
                    {stats.unreadEmployeesThisMonth.length > 0 ? (
                      <Button
                        size="small"
                        loading={remindLoading}
                        onClick={() => void handleRemindAll()}
                        className="dashboard-remind-btn"
                      >
                        Relancer tous
                      </Button>
                    ) : null}
                  </div>
                  <Table<UnreadEmployeeMonthRow>
                    rowKey="payslipId"
                    size="small"
                    pagination={false}
                    dataSource={stats.unreadEmployeesThisMonth}
                    columns={unreadColumns}
                    locale={{
                      emptyText: 'Aucun bulletin non consulté ce mois',
                    }}
                  />
                </div>

                <div ref={cddRef} className="dashboard-table-panel">
                  <div className="dashboard-chart-panel__title">
                    <CalendarOutlined
                      style={{ color: adminTheme.orange, marginRight: 8 }}
                    />
                    Alertes contrats
                  </div>
                  <div className="dashboard-chart-panel__subtitle dashboard-chart-panel__subtitle--mb">
                    CDD / intérim / stage — 30 prochains jours
                  </div>
                  {stats.expiringContracts.length === 0 ? (
                    <div className="dashboard-empty-placeholder">
                      Aucun contrat n’expire prochainement
                    </div>
                  ) : (
                    <Table<ExpiringContractDashboardRow>
                      rowKey="userId"
                      size="small"
                      pagination={false}
                      dataSource={stats.expiringContracts}
                      columns={expiringColumns}
                    />
                  )}
                </div>
              </div>

              <div className="dashboard-recent-panel">
                <div className="dashboard-chart-panel__title dashboard-chart-panel__title--mb">
                  Derniers bulletins déposés
                </div>
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={stats.recentPayslips}
                  columns={recentColumns}
                />
              </div>

              <div className="dashboard-legacy-links">
                <Typography.Text type="secondary">
                  <Link to={`${ADMIN_BASE}/employees`}>Collaborateurs</Link>
                  {' · '}
                  <Link to={`${ADMIN_BASE}/payslips`}>Tous les bulletins</Link>
                  {' · '}
                  <Link to={`${ADMIN_BASE}/employees?expiringContracts=1`}>
                    Filtre contrats
                  </Link>
                </Typography.Text>
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
