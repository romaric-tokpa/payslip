import { SafetyCertificateOutlined } from '@ant-design/icons'
import { App, Card, Col, Row, Spin, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SUPER_ADMIN_BASE } from '../../constants/adminRoutes'
import * as superAdminApi from '../../services/super-admin.service'
import type {
  PlatformStats,
  RecentCompanyRow,
  SuperAdminCompanyOverview,
  SuperAdminGrowthData,
} from '../../types/super-admin'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './superAdminPages.css'

dayjs.extend(relativeTime)
dayjs.locale('fr')

function chronoMonths<T extends { month: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.month.localeCompare(b.month))
}

function monthTick(ym: string): string {
  const [y, m] = ym.split('-')
  const mi = Number(m)
  if (!y || !mi || mi < 1 || mi > 12) {
    return ym
  }
  const short = [
    'janv.',
    'févr.',
    'mars',
    'avr.',
    'mai',
    'juin',
    'juil.',
    'août',
    'sept.',
    'oct.',
    'nov.',
    'déc.',
  ]
  return `${short[mi - 1]} ${y}`
}

function planTag(plan: string) {
  const p = plan.toLowerCase()
  if (p === 'trial') {
    return <Tag>trial</Tag>
  }
  if (p === 'starter') {
    return <Tag color="blue">starter</Tag>
  }
  if (p === 'business') {
    return <Tag color="cyan">business</Tag>
  }
  if (p === 'enterprise') {
    return <Tag color="orange">enterprise</Tag>
  }
  return <Tag>{plan}</Tag>
}

export function SuperAdminDashboard() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [growth, setGrowth] = useState<SuperAdminGrowthData | null>(null)
  const [topCompanies, setTopCompanies] = useState<
    SuperAdminCompanyOverview[]
  >([])
  const [recent, setRecent] = useState<RecentCompanyRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [st, gr, top, rec] = await Promise.all([
        superAdminApi.getPlatformStats(),
        superAdminApi.getGrowthData(),
        superAdminApi.getSuperAdminCompanies({
          sortBy: 'employeeCount',
          sortOrder: 'desc',
          page: 1,
          limit: 10,
        }),
        superAdminApi.getRecentCompanies(),
      ])
      setStats(st)
      setGrowth(gr)
      setTopCompanies(top.companies)
      setRecent(rec)
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Chargement impossible'))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const chartData = useMemo(() => {
    if (!growth?.companiesByMonth?.length) {
      return []
    }
    return chronoMonths(growth.companiesByMonth).map((r) => ({
      month: monthTick(r.month),
      count: r.count,
    }))
  }, [growth])

  const activePct = useMemo(() => {
    if (!stats || stats.totalCompanies <= 0) {
      return 0
    }
    return Math.round((stats.activeCompanies / stats.totalCompanies) * 100)
  }, [stats])

  const topColumns: ColumnsType<SuperAdminCompanyOverview> = useMemo(
    () => [
      {
        title: 'Entreprise',
        dataIndex: 'name',
        key: 'name',
        render: (name: string, row) => (
          <Link to={`${SUPER_ADMIN_BASE}/companies/${row.id}`}>{name}</Link>
        ),
      },
      {
        title: 'Collaborateurs',
        key: 'emp',
        width: 120,
        render: (_, row) => `${row.activeCount} / ${row.employeeCount}`,
      },
      {
        title: 'Dernier upload',
        key: 'last',
        width: 140,
        render: (_, row) =>
          row.lastActivity
            ? dayjs(row.lastActivity).fromNow()
            : '—',
      },
      {
        title: 'Plan',
        key: 'plan',
        width: 120,
        render: (_, row) => planTag(row.plan),
      },
      {
        title: 'Signature',
        key: 'sig',
        width: 100,
        render: (_, row) =>
          row.requireSignature ? (
            <Tag color="blue">Exigée</Tag>
          ) : (
            <Tag>Non</Tag>
          ),
      },
    ],
    [],
  )

  if (loading && !stats) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const g = stats.growth
  const sig = stats.signatures ?? {
    companiesRequiringSignature: 0,
    recordedThisMonth: 0,
    totalRecorded: 0,
  }

  return (
    <div>
      <h1 className="sa-page-title">Console plateforme</h1>
      <p className="sa-page-lead">
        Vue d’ensemble multi-entreprise : inscriptions, usage des bulletins,
        signature électronique des accusés de réception et entreprises les plus
        actives.
      </p>

      <Row gutter={[16, 16]} className="sa-kpi-row">
        <Col xs={24} sm={12} lg={6}>
          <Card className="sa-kpi-card" variant="outlined">
            <div className="sa-kpi-label">Entreprises</div>
            <div className="sa-kpi-value">{stats.totalCompanies}</div>
            <div className="sa-kpi-sub sa-kpi-sub--up">
              +{g.companiesThisMonth} ce mois
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="sa-kpi-card" variant="outlined">
            <div className="sa-kpi-label">Collaborateurs</div>
            <div className="sa-kpi-value">{stats.totalUsers}</div>
            <div className="sa-kpi-sub sa-kpi-sub--up">
              +{g.usersThisMonth} ce mois
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="sa-kpi-card" variant="outlined">
            <div className="sa-kpi-label">Bulletins</div>
            <div className="sa-kpi-value">{stats.totalPayslips}</div>
            <div className="sa-kpi-sub sa-kpi-sub--up">
              +{g.payslipsThisMonth} ce mois
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="sa-kpi-card" variant="outlined">
            <div className="sa-kpi-label">Entreprises actives</div>
            <div className="sa-kpi-value">
              {stats.activeCompanies}{' '}
              <span style={{ fontSize: 16, fontWeight: 500, color: '#7f8c8d' }}>
                / {stats.totalCompanies}
              </span>
            </div>
            <div className="sa-kpi-sub">{activePct}% du parc</div>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <span>
            <SafetyCertificateOutlined style={{ marginRight: 8 }} />
            Signatures électroniques
          </span>
        }
        className="sa-section-card"
        variant="outlined"
        style={{ marginTop: 24 }}
      >
        <div className="sa-signature-strip">
          <div className="sa-signature-metric">
            <div className="sa-kpi-label">Entreprises avec exigence</div>
            <div className="sa-kpi-value">
              {sig.companiesRequiringSignature}
            </div>
            <div className="sa-kpi-sub">
              sur {stats.totalCompanies} entreprise
              {stats.totalCompanies !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="sa-signature-metric">
            <div className="sa-kpi-label">Accusés enregistrés (mois en cours)</div>
            <div className="sa-kpi-value">{sig.recordedThisMonth}</div>
            <div className="sa-kpi-sub">UTC, depuis le 1er du mois</div>
          </div>
          <div className="sa-signature-metric">
            <div className="sa-kpi-label">Total historique</div>
            <div className="sa-kpi-value">{sig.totalRecorded}</div>
            <div className="sa-kpi-sub">Signatures enregistrées sur la plateforme</div>
          </div>
        </div>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
          Les collaborateurs signent depuis l’application mobile ; les RH
          suivent l’état dans l’admin entreprise. La page publique de vérification
          permet de contrôler un accusé à partir de son identifiant.
        </Typography.Paragraph>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={14}>
          <Card
            title="Croissance entreprises"
            className="sa-section-card"
            variant="outlined"
            style={{ minHeight: 360 }}
          >
            {chartData.length === 0 ? (
              <div style={{ color: '#7f8c8d', padding: 24 }}>
                Pas encore assez de données.
              </div>
            ) : (
              <div className="sa-recharts-box">
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#F28C28"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="Top 10 entreprises"
            className="sa-section-card"
            variant="outlined"
          >
            <Table<SuperAdminCompanyOverview>
              size="small"
              rowKey="id"
              pagination={false}
              columns={topColumns}
              dataSource={topCompanies}
              locale={{ emptyText: 'Aucune entreprise' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Dernières inscriptions"
        className="sa-section-card"
        variant="outlined"
        style={{ marginTop: 24 }}
      >
        <Table<RecentCompanyRow>
          size="small"
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'Aucune inscription récente' }}
          columns={[
            {
              title: 'Entreprise',
              dataIndex: 'name',
              key: 'name',
              render: (name: string, row) => (
                <Link to={`${SUPER_ADMIN_BASE}/companies/${row.id}`}>
                  {name}
                </Link>
              ),
            },
            {
              title: 'Date',
              dataIndex: 'createdAt',
              key: 'createdAt',
              width: 160,
              render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
            },
            {
              title: 'Admin',
              key: 'admin',
              render: (_, row) => row.adminEmail ?? '—',
            },
            {
              title: 'Collaborateurs',
              dataIndex: 'employeeCount',
              key: 'employeeCount',
              width: 120,
            },
            {
              title: 'Plan',
              key: 'plan',
              width: 100,
              render: (_, row) => planTag(row.plan),
            },
          ]}
          dataSource={recent}
        />
      </Card>
    </div>
  )
}
