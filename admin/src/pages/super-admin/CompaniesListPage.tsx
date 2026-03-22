import { LoginOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import type { MenuProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SUPER_ADMIN_BASE } from '../../constants/adminRoutes'
import * as superAdminApi from '../../services/super-admin.service'
import type { SuperAdminCompanyOverview } from '../../types/super-admin'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { openAdminTabWithImpersonationSession } from '../../utils/openImpersonationTab'
import './superAdminPages.css'

dayjs.extend(relativeTime)
dayjs.locale('fr')

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

export function CompaniesListPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<
    'active' | 'inactive' | 'trial' | undefined
  >()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SuperAdminCompanyOverview[]>([])

  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [planModalCompany, setPlanModalCompany] =
    useState<SuperAdminCompanyOverview | null>(null)
  const [planChoice, setPlanChoice] = useState<string>('trial')
  const [planSaving, setPlanSaving] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, planFilter, statusFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await superAdminApi.getSuperAdminCompanies({
        search: debouncedSearch || undefined,
        plan: planFilter,
        status: statusFilter,
        page,
        limit,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      setRows(res.companies)
      setTotal(res.total)
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Liste indisponible'))
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, limit, message, page, planFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openPlanModal = useCallback((row: SuperAdminCompanyOverview) => {
    setPlanModalCompany(row)
    setPlanChoice(row.plan || 'trial')
    setPlanModalOpen(true)
  }, [])

  const savePlan = async () => {
    if (!planModalCompany) {
      return
    }
    setPlanSaving(true)
    try {
      await superAdminApi.updateSuperAdminCompany(planModalCompany.id, {
        plan: planChoice,
      })
      message.success('Plan mis à jour')
      setPlanModalOpen(false)
      void load()
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Mise à jour impossible'))
    } finally {
      setPlanSaving(false)
    }
  }

  const confirmImpersonate = useCallback((row: SuperAdminCompanyOverview) => {
    const admin = row.admin
    const adminLabel = admin
      ? `${admin.firstName} ${admin.lastName}`.trim()
      : 'l’administrateur'
    modal.confirm({
      title: 'Se connecter en tant que',
      content: (
        <span>
          Vous allez ouvrir une session en tant que{' '}
          <strong>{adminLabel}</strong> ({admin?.email ?? '—'}) pour{' '}
          <strong>{row.name}</strong>. Cette action est enregistrée dans le
          journal d’audit.
        </span>
      ),
      okText: 'Continuer',
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          const session = await superAdminApi.impersonateCompanyRh(row.id)
          const ok = openAdminTabWithImpersonationSession(session)
          if (!ok) {
            message.warning(
              'Pop-up bloquée : autorisez les fenêtres pour ce site, puis réessayez.',
            )
            throw new Error('popup_blocked')
          }
          message.success(
            'Nouvel onglet ouvert : la session admin entreprise s’y applique automatiquement.',
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
  }, [message, modal])

  const confirmToggleActive = useCallback((row: SuperAdminCompanyOverview) => {
    const next = !row.isActive
    modal.confirm({
      title: next ? 'Réactiver l’entreprise' : 'Désactiver l’entreprise',
      content: next
        ? `Réactiver « ${row.name} » ? Les administrateurs pourront à nouveau se connecter.`
        : `Désactiver « ${row.name} » (ex. impayé) ?`,
      okText: 'Confirmer',
      cancelText: 'Annuler',
      okButtonProps: next ? {} : { danger: true },
      onOk: async () => {
        try {
          await superAdminApi.updateSuperAdminCompany(row.id, {
            isActive: next,
          })
          message.success(next ? 'Entreprise réactivée' : 'Entreprise désactivée')
          void load()
        } catch (e) {
          message.error(getApiErrorMessage(e, 'Mise à jour impossible'))
        }
      },
    })
  }, [message, modal, load])

  const columns: ColumnsType<SuperAdminCompanyOverview> = useMemo(
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
        title: 'Admin',
        key: 'admin',
        width: 200,
        ellipsis: true,
        render: (_, row) => {
          const a = row.admin
          if (!a) {
            return '—'
          }
          return (
            <span>
              {a.firstName} {a.lastName}
              <br />
              <span style={{ color: '#7f8c8d', fontSize: 12 }}>{a.email}</span>
            </span>
          )
        },
      },
      {
        title: 'Plan',
        key: 'plan',
        width: 110,
        render: (_, row) => planTag(row.plan),
      },
      {
        title: 'Signature',
        key: 'requireSignature',
        width: 100,
        render: (_, row) =>
          row.requireSignature ? (
            <Tag color="blue">Exigée</Tag>
          ) : (
            <Tag>Non</Tag>
          ),
      },
      {
        title: 'Collaborateurs',
        key: 'emp',
        width: 120,
        render: (_, row) => `${row.activeCount} / ${row.employeeCount}`,
      },
      {
        title: 'Bulletins',
        dataIndex: 'payslipCount',
        key: 'payslipCount',
        width: 90,
      },
      {
        title: 'Dernière activité',
        key: 'last',
        width: 130,
        render: (_, row) =>
          row.lastActivity ? dayjs(row.lastActivity).fromNow() : '—',
      },
      {
        title: 'Inscrit le',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 120,
        render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 96,
        fixed: 'right',
        render: (_, row) => {
          const items: MenuProps['items'] = [
            {
              key: 'detail',
              label: 'Voir détail',
              onClick: () =>
                navigate(`${SUPER_ADMIN_BASE}/companies/${row.id}`),
            },
            {
              key: 'plan',
              label: 'Modifier le plan',
              onClick: () => openPlanModal(row),
            },
            {
              key: 'imp',
              label: 'Se connecter en tant que',
              icon: <LoginOutlined />,
              disabled: !row.admin,
              onClick: () => {
                confirmImpersonate(row)
              },
            },
            { type: 'divider' },
            {
              key: 'toggle',
              label: row.isActive ? 'Désactiver' : 'Réactiver',
              danger: row.isActive,
              onClick: () => {
                confirmToggleActive(row)
              },
            },
          ]
          return (
            <Dropdown menu={{ items }} trigger={['click']}>
              <Button size="small" type="link">
                Actions
              </Button>
            </Dropdown>
          )
        },
      },
    ],
    [confirmImpersonate, confirmToggleActive, navigate, openPlanModal],
  )

  return (
    <div>
      <h1 className="sa-page-title">Entreprises clientes</h1>
      <p className="sa-page-lead">
        Recherche, filtres par plan et statut, gestion du plan et impersonation
        sécurisée (tracée).
      </p>

      <Space wrap style={{ marginBottom: 16 }} size="middle">
        <Input.Search
          allowClear
          placeholder="Nom, RCCM ou e-mail admin…"
          style={{ width: 280 }}
          onSearch={(v) => setSearch(v)}
          onChange={(e) => setSearch(e.target.value)}
          value={search}
        />
        <Select
          allowClear
          placeholder="Plan"
          style={{ width: 140 }}
          value={planFilter}
          onChange={(v) => setPlanFilter(v)}
          options={PLANS.map((p) => ({ value: p, label: p }))}
        />
        <Select
          allowClear
          placeholder="Statut"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { value: 'active', label: 'Actives' },
            { value: 'inactive', label: 'Inactives' },
            { value: 'trial', label: 'Essai (trial)' },
          ]}
        />
      </Space>

      <Card variant="outlined">
        <Table<SuperAdminCompanyOverview>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 980 }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (t) => `${t} entreprise(s)`,
            onChange: (p, ps) => {
              setPage(p)
              setLimit(ps)
            },
          }}
        />
      </Card>

      <Modal
        title="Modifier le plan"
        open={planModalOpen}
        onCancel={() => setPlanModalOpen(false)}
        onOk={() => void savePlan()}
        confirmLoading={planSaving}
        okText="Enregistrer"
      >
        <p style={{ marginBottom: 12 }}>
          {planModalCompany?.name ?? ''}
        </p>
        <Select
          style={{ width: '100%' }}
          value={planChoice}
          onChange={(v) => setPlanChoice(v)}
          options={PLANS.map((p) => ({ value: p, label: p }))}
        />
      </Modal>
    </div>
  )
}
