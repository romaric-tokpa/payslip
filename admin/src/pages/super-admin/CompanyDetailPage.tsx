import {
  App,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tree,
} from 'antd'
import type { DataNode } from 'antd/es/tree'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SUPER_ADMIN_BASE } from '../../constants/adminRoutes'
import * as superAdminApi from '../../services/super-admin.service'
import type { SuperAdminCompanyDetail } from '../../types/super-admin'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { openAdminTabWithImpersonationSession } from '../../utils/openImpersonationTab'
import './superAdminPages.css'

dayjs.extend(relativeTime)
dayjs.locale('fr')

type RhAdminRow = SuperAdminCompanyDetail['rhAdmins'][number]

const PLANS = ['trial', 'starter', 'business', 'enterprise'] as const

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

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<SuperAdminCompanyDetail | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editPlan, setEditPlan] = useState('trial')
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      return
    }
    setLoading(true)
    try {
      const d = await superAdminApi.getSuperAdminCompanyDetail(id)
      setDetail(d)
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Entreprise introuvable'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [id, message])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = () => {
    if (!detail) {
      return
    }
    setEditPlan(detail.plan || 'trial')
    setEditName(detail.name)
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!detail) {
      return
    }
    setSaving(true)
    try {
      await superAdminApi.updateSuperAdminCompany(detail.id, {
        plan: editPlan,
        name: editName.trim() || undefined,
      })
      message.success('Entreprise mise à jour')
      setEditOpen(false)
      void load()
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Échec de la mise à jour'))
    } finally {
      setSaving(false)
    }
  }

  const impersonate = useCallback(() => {
    if (!detail) {
      return
    }
    const admin = detail.rhAdmins[0]
    const adminLabel = admin
      ? `${admin.firstName} ${admin.lastName}`.trim()
      : 'l’administrateur'
    modal.confirm({
      title: 'Se connecter en tant que',
      content: (
        <span>
          Session en tant que <strong>{adminLabel}</strong> pour{' '}
          <strong>{detail.name}</strong>. Action tracée dans l’audit.
        </span>
      ),
      okText: 'Continuer',
      onOk: async () => {
        try {
          const session = await superAdminApi.impersonateCompanyRh(detail.id)
          const ok = openAdminTabWithImpersonationSession(session)
          if (!ok) {
            message.warning(
              'Pop-up bloquée : autorisez les fenêtres pour ce site, puis réessayez.',
            )
            throw new Error('popup_blocked')
          }
          message.success(
            'Nouvel onglet ouvert : session admin entreprise appliquée automatiquement.',
          )
        } catch (e) {
          if (e instanceof Error && e.message === 'popup_blocked') {
            throw e
          }
          message.error(getApiErrorMessage(e, 'Impersonation impossible'))
          throw e
        }
      },
    })
  }, [detail, message, modal])

  const barData = useMemo(() => {
    if (!detail?.stats.payslipsByMonth?.length) {
      return []
    }
    return [...detail.stats.payslipsByMonth]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({
        label: monthTick(r.month),
        count: r.count,
      }))
  }, [detail])

  const treeData: DataNode[] = useMemo(() => {
    if (!detail?.directions.length) {
      return []
    }
    return detail.directions.map((dir) => ({
      title: `${dir.name} (${dir.departments.length} dépt.)`,
      key: `d-${dir.id}`,
      children: dir.departments.map((dep) => ({
        title: `${dep.name} (${dep.services.length} svc.)`,
        key: `dep-${dep.id}`,
        children: dep.services.map((s) => ({
          title: s.name,
          key: `s-${s.id}`,
        })),
      })),
    }))
  }, [detail])

  const adminColumns: ColumnsType<RhAdminRow> = useMemo(
    () => [
      {
        title: 'Nom',
        key: 'name',
        render: (_, a) => `${a.firstName} ${a.lastName}`,
      },
      { title: 'E-mail', dataIndex: 'email', key: 'email' },
      {
        title: 'Fonction',
        dataIndex: 'position',
        key: 'position',
        width: 160,
        ellipsis: true,
        render: (v: string | null) =>
          v?.trim() ? v.trim() : '—',
      },
      {
        title: 'Créé le',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 140,
        render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
      },
      {
        title: 'Dernier login',
        key: 'll',
        width: 120,
        render: () => '—',
      },
    ],
    [],
  )

  if (loading && !detail) {
    return <div style={{ padding: 48 }}>Chargement…</div>
  }

  if (!detail) {
    return (
      <div>
        <p>Entreprise introuvable.</p>
        <Link to={`${SUPER_ADMIN_BASE}/companies`}>Retour à la liste</Link>
      </div>
    )
  }

  const st = detail.stats
  const org = st.orgStructure

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Button type="link" onClick={() => navigate(`${SUPER_ADMIN_BASE}/companies`)}>
          ← Entreprises
        </Button>
      </Space>

      <header style={{ marginBottom: 24 }}>
        <Space wrap align="center">
          <h1 className="sa-page-title" style={{ margin: 0 }}>
            {detail.name}
          </h1>
          {planTag(detail.plan)}
          {detail.isActive ? (
            <Tag color="green">Active</Tag>
          ) : (
            <Tag color="red">Inactive</Tag>
          )}
        </Space>
        <p style={{ color: '#5c6b7a', margin: '8px 0 0', lineHeight: 1.6 }}>
          RCCM : {detail.rccm ?? '—'} · Téléphone :{' '}
          {detail.phone?.trim() ? detail.phone.trim() : '—'} · Inscrite le{' '}
          {dayjs(detail.createdAt).format('DD/MM/YYYY')}
        </p>
        <Space style={{ marginTop: 16 }}>
          <Button onClick={openEdit}>Modifier</Button>
          <Button type="primary" onClick={() => impersonate()}>
            Se connecter en tant que
          </Button>
        </Space>
      </header>

      <Row gutter={[16, 16]} className="sa-kpi-row">
        <Col xs={24} sm={12} lg={8}>
          <Card className="sa-kpi-card" variant="outlined">
            <div className="sa-kpi-label">Collaborateurs actifs / total</div>
            <div className="sa-kpi-value">
              {st.activeEmployees}{' '}
              <span style={{ fontSize: 16, color: '#7f8c8d' }}>
                / {st.totalEmployees}
              </span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="sa-kpi-card" variant="outlined">
            <div className="sa-kpi-label">Partis</div>
            <div className="sa-kpi-value">{st.departedEmployees}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="sa-kpi-card" variant="outlined">
            <div className="sa-kpi-label">Bulletins</div>
            <div className="sa-kpi-value">{st.totalPayslips}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="sa-kpi-card" variant="outlined">
            <div className="sa-kpi-label">Taux de consultation</div>
            <div className="sa-kpi-value">{st.consultationRate}%</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="sa-kpi-card" variant="outlined">
            <div className="sa-kpi-label">Structure</div>
            <div className="sa-kpi-value" style={{ fontSize: 20 }}>
              {org.directions} dir. · {org.departments} dépt. · {org.services}{' '}
              svc.
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className="sa-kpi-card" variant="outlined">
            <div className="sa-kpi-label">Dernier upload</div>
            <div className="sa-kpi-value" style={{ fontSize: 20 }}>
              {st.lastUploadAt
                ? dayjs(st.lastUploadAt).format('DD/MM/YYYY HH:mm')
                : '—'}
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title="Bulletins par mois"
        className="sa-section-card"
        variant="outlined"
        style={{ marginBottom: 24 }}
      >
        {barData.length === 0 ? (
          <div style={{ color: '#7f8c8d' }}>Aucune donnée sur 12 mois.</div>
        ) : (
          <div className="sa-recharts-box sa-recharts-box--320">
            <ResponsiveContainer width="100%" height={320} minWidth={0}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0F5C5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card
        title="Administrateurs RH"
        className="sa-section-card"
        variant="outlined"
        style={{ marginBottom: 24 }}
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={adminColumns}
          dataSource={detail.rhAdmins}
        />
      </Card>

      <Card title="Organigramme (aperçu)" className="sa-section-card" variant="outlined">
        {treeData.length === 0 ? (
          <span style={{ color: '#7f8c8d' }}>Aucune direction.</span>
        ) : (
          <Tree showLine defaultExpandAll treeData={treeData} />
        )}
      </Card>

      <Modal
        title="Modifier l’entreprise"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => void saveEdit()}
        confirmLoading={saving}
        okText="Enregistrer"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: 6 }}>Nom</div>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6 }}>Plan</div>
            <Select
              style={{ width: '100%' }}
              value={editPlan}
              onChange={(v) => setEditPlan(v)}
              options={PLANS.map((p) => ({ value: p, label: p }))}
            />
          </div>
        </Space>
      </Modal>
    </div>
  )
}
