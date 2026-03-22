import {
  CalendarOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  DatePicker,
  Progress,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
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
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './dashboard.css'

dayjs.extend(relativeTime)
dayjs.extend(utc)
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

/** Mois (1–12) et année UTC — source de vérité pour l’API (évite dayjs invalides du DatePicker). */
function utcPeriodNowParts(): { month: number; year: number } {
  const d = dayjs.utc()
  return { month: d.month() + 1, year: d.year() }
}

type DashboardPeriodMode = 'month' | 'year'

export function DashboardPage() {
  const { message } = App.useApp()
  const { isLoading: authLoading, isAuthenticated, accessToken } = useAuth()
  const cddRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [remindLoading, setRemindLoading] = useState(false)
  const [periodMode, setPeriodMode] = useState<DashboardPeriodMode>('month')
  const [periodParts, setPeriodParts] = useState(utcPeriodNowParts)
  const [yearOnly, setYearOnly] = useState(() => utcPeriodNowParts().year)

  const periodPickerValue = useMemo(
    () =>
      dayjs()
        .year(periodParts.year)
        .month(periodParts.month - 1)
        .date(1)
        .startOf('month'),
    [periodParts.month, periodParts.year],
  )

  const yearPickerValue = useMemo(
    () => dayjs().year(yearOnly).startOf('year'),
    [yearOnly],
  )

  const canRemindUnread = useMemo(() => {
    if (periodMode !== 'month') {
      return false
    }
    const cur = utcPeriodNowParts()
    return (
      periodParts.year === cur.year && periodParts.month === cur.month
    )
  }, [periodMode, periodParts.month, periodParts.year])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data =
        periodMode === 'year'
          ? await dashboardApi.getDashboardStats({
              scope: 'year',
              year: yearOnly,
            })
          : await dashboardApi.getDashboardStats({
              scope: 'month',
              month: periodParts.month,
              year: periodParts.year,
            })
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
  }, [periodMode, yearOnly, periodParts.month, periodParts.year])

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
    return stats.charts.consultationByMonth.map((item) => {
      let short =
        item.month.length >= 7 ? item.month.slice(5) : item.month
      if (
        stats?.viewGranularity === 'YEAR' &&
        item.month.length >= 7
      ) {
        const mi = Number.parseInt(item.month.slice(5, 7), 10)
        if (mi >= 1 && mi <= 12) {
          short = MONTH_LABELS_SHORT[mi - 1]
        }
      }
      return {
        monthKey: item.month,
        month: short,
        rate: item.rate,
        total: item.total,
        read: item.read,
      }
    })
  }, [stats?.charts.consultationByMonth, stats?.viewGranularity])

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
    if (stats.viewGranularity === 'YEAR') {
      return `Année ${stats.currentMonth.year}`
    }
    const m = stats.currentMonth.month
    const label = MONTH_LABELS_SHORT[m - 1] ?? String(m)
    return `${label} ${stats.currentMonth.year}`
  }, [stats])

  const signaturePeriodLabel = useMemo(() => {
    if (!stats) {
      return ''
    }
    if (stats.viewGranularity === 'YEAR') {
      return `Année ${stats.signaturePeriodYear}`
    }
    return `${MONTH_LABELS_SHORT[stats.signaturePeriodMonth - 1] ?? ''} ${stats.signaturePeriodYear}`
  }, [stats])

  const trendVsPreviousPeriod = useMemo(() => {
    if (stats?.viewGranularity === 'YEAR') {
      return 'vs année précédente'
    }
    return 'vs mois précédent'
  }, [stats?.viewGranularity])

  const trendEmployeesLabel = useMemo(() => {
    if (stats?.viewGranularity === 'YEAR') {
      return 'année vs année précédente'
    }
    return 'période vs mois précédent'
  }, [stats?.viewGranularity])

  const consultationChartSubtitle = useMemo(() => {
    if (!stats) {
      return ''
    }
    if (stats.viewGranularity === 'YEAR') {
      return `Par mois de paie — ${currentMonthLabel}`
    }
    return `12 mois de paie se terminant à ${currentMonthLabel}`
  }, [stats, currentMonthLabel])

  const unreadColumns: ColumnsType<UnreadEmployeeMonthRow> = useMemo(
    () => [
      {
        title: 'Collaborateur',
        key: 'name',
        render: (_, record) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar
              size={56}
              src={record.profilePhotoUrl ?? undefined}
              alt=""
              className="employee-table-avatar employee-table-avatar--active"
            >
              {initialsFromName(record.name)}
            </Avatar>
            <div className="employee-table-name-cell">
              <div className="employee-table-name">{record.name}</div>
              <div className="employee-table-matricule">
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
          <div className="employee-table-name-cell">
            <div className="employee-table-name">
              {r.firstName} {r.lastName}
            </div>
            <div className="employee-table-matricule">
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
        render: (_, r) => {
          const fullName = `${r.user.firstName} ${r.user.lastName}`.trim()
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar
                size={56}
                src={r.user.profilePhotoUrl ?? undefined}
                alt=""
                className="employee-table-avatar employee-table-avatar--active"
              >
                {initialsFromName(fullName)}
              </Avatar>
              <div className="employee-table-name-cell">
                <div className="employee-table-name">{fullName}</div>
                <div className="employee-table-matricule">
                  {r.user.employeeId?.trim() || '—'}
                </div>
              </div>
            </div>
          )
        },
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
      <header className="dashboard-intro" aria-label="Tableau de bord">
        <div className="dashboard-intro__filters">
          <span className="dashboard-intro__period-label" id="dashboard-period-label">
            Période (UTC)
          </span>
          <Segmented<DashboardPeriodMode>
            value={periodMode}
            onChange={(mode) => {
              setPeriodMode(mode)
              if (mode === 'year') {
                setYearOnly(periodParts.year)
              } else {
                setPeriodParts((p) => ({ ...p, year: yearOnly }))
              }
            }}
            options={[
              { label: 'Mois', value: 'month' },
              { label: 'Année', value: 'year' },
            ]}
            aria-labelledby="dashboard-period-label"
          />
          {periodMode === 'month' ? (
            <DatePicker
              picker="month"
              allowClear={false}
              format="MMMM YYYY"
              value={periodPickerValue}
              onChange={(d) => {
                if (d != null && d.isValid()) {
                  setPeriodParts({
                    month: d.month() + 1,
                    year: d.year(),
                  })
                }
              }}
              disabledDate={(current) => {
                if (current == null) {
                  return false
                }
                const cUtc = dayjs.utc([current.year(), current.month(), 1])
                return cUtc.isAfter(dayjs.utc(), 'month')
              }}
              aria-label="Mois et année de paie"
            />
          ) : (
            <DatePicker
              picker="year"
              allowClear={false}
              format="YYYY"
              value={yearPickerValue}
              onChange={(d) => {
                if (d != null && d.isValid()) {
                  setYearOnly(d.year())
                }
              }}
              disabledDate={(current) =>
                current != null &&
                current.year() > dayjs.utc().year()
              }
              aria-label="Année civile UTC"
            />
          )}
        </div>
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
                  trendLabel={trendEmployeesLabel}
                />
                <KpiCard
                  label="Bulletins distribués"
                  value={stats.currentMonth.payslipsDistributed}
                  suffix={`${currentMonthLabel} (paie)`}
                  trend={stats.trends.payslipsDelta}
                  trendLabel={trendVsPreviousPeriod}
                />
                <KpiCard
                  label="Taux de consultation"
                  value={`${stats.currentMonth.consultationRate}%`}
                  valueColor={consultationRateColor(
                    stats.currentMonth.consultationRate,
                  )}
                  trend={stats.trends.consultationRateDelta}
                  trendSuffix="%"
                  trendLabel={trendVsPreviousPeriod}
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
                        {consultationChartSubtitle}
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
                        <RechartsTooltip
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
                    Période {currentMonthLabel} — tri par taux croissant
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
                        <RechartsTooltip
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
                      <Tooltip
                        title={
                          periodMode === 'year'
                            ? 'Passez en vue « Mois » sur le mois UTC en cours pour relancer.'
                            : canRemindUnread
                              ? undefined
                              : 'La relance par notification concerne uniquement le mois civil UTC en cours.'
                        }
                      >
                        <span>
                          <Button
                            size="small"
                            loading={remindLoading}
                            disabled={
                              periodMode === 'year' || !canRemindUnread
                            }
                            onClick={() => void handleRemindAll()}
                            className="dashboard-remind-btn"
                          >
                            Relancer tous
                          </Button>
                        </span>
                      </Tooltip>
                    ) : null}
                  </div>
                  <Table<UnreadEmployeeMonthRow>
                    rowKey="payslipId"
                    size="small"
                    pagination={false}
                    dataSource={stats.unreadEmployeesThisMonth}
                    columns={unreadColumns}
                    locale={{
                      emptyText:
                        stats.viewGranularity === 'YEAR'
                          ? 'Aucun bulletin non consulté sur cette année'
                          : 'Aucun bulletin non consulté ce mois',
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
                <div className="dashboard-chart-panel__title">
                  Derniers bulletins déposés
                </div>
                <div className="dashboard-chart-panel__subtitle dashboard-chart-panel__subtitle--mb">
                  {stats.viewGranularity === 'YEAR'
                    ? `Déposés sur l’année ${stats.currentMonth.year} (UTC) — jusqu’à 10 plus récents`
                    : `Déposés en ${currentMonthLabel} (UTC) — 5 plus récents`}
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
