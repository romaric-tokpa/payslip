import { App, Card, Col, Row, Spin } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import * as superAdminApi from '../../services/super-admin.service'
import type { SuperAdminGrowthData } from '../../types/super-admin'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './superAdminPages.css'

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

const BAR_ORANGE = '#F28C28'
const BAR_TEAL = '#0F5C5E'

export function GrowthPage() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SuperAdminGrowthData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await superAdminApi.getGrowthData()
      setData(d)
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Données indisponibles'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const companiesSeries = useMemo(() => {
    if (!data?.companiesByMonth?.length) {
      return []
    }
    return chronoMonths(data.companiesByMonth).map((r) => ({
      label: monthTick(r.month),
      count: r.count,
    }))
  }, [data])

  const usersSeries = useMemo(() => {
    if (!data?.usersByMonth?.length) {
      return []
    }
    return chronoMonths(data.usersByMonth).map((r) => ({
      label: monthTick(r.month),
      count: r.count,
    }))
  }, [data])

  const payslipsSeries = useMemo(() => {
    if (!data?.payslipsByMonth?.length) {
      return []
    }
    return chronoMonths(data.payslipsByMonth).map((r) => ({
      label: monthTick(r.month),
      count: r.count,
    }))
  }, [data])

  const topHorizontal = useMemo(() => {
    if (!data?.topCompanies?.length) {
      return []
    }
    return [...data.topCompanies]
      .sort((a, b) => a.userCount - b.userCount)
      .map((c) => ({
        name:
          c.name.length > 28 ? `${c.name.slice(0, 26)}…` : c.name,
        fullName: c.name,
        collaborators: c.userCount,
      }))
  }, [data])

  const topBarHeight = Math.max(300, topHorizontal.length * 40)

  if (loading && !data) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="sa-page-title">Croissance</h1>
      <p className="sa-page-lead">
        Inscriptions entreprises, nouveaux collaborateurs et bulletins
        distribués sur 12 mois glissants.
      </p>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Nouvelles entreprises" className="sa-section-card" variant="outlined">
            <div className="sa-recharts-box">
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <LineChart data={companiesSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={BAR_ORANGE}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24}>
          <Card
            title="Nouveaux collaborateurs"
            className="sa-section-card"
            variant="outlined"
          >
            <div className="sa-recharts-box">
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <BarChart data={usersSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill={BAR_TEAL} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24}>
          <Card
            title="Bulletins distribués"
            className="sa-section-card"
            variant="outlined"
          >
            <div className="sa-recharts-box">
              <ResponsiveContainer width="100%" height={300} minWidth={0}>
                <BarChart data={payslipsSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1c2833" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24}>
          <Card
            title="Top 10 entreprises (collaborateurs)"
            className="sa-section-card"
            variant="outlined"
          >
            <div
              className="sa-recharts-box"
              style={{ height: topBarHeight }}
            >
              <ResponsiveContainer
                width="100%"
                height={topBarHeight}
                minWidth={0}
              >
                <BarChart
                  layout="vertical"
                  data={topHorizontal}
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      typeof value === 'number' ? value : value,
                      'Collaborateurs',
                    ]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | { fullName?: string }
                        | undefined
                      return row?.fullName ?? ''
                    }}
                  />
                  <Bar dataKey="collaborators" radius={[0, 4, 4, 0]}>
                    {topHorizontal.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i % 2 === 0 ? BAR_TEAL : BAR_ORANGE}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
