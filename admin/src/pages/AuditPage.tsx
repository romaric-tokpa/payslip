import {
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Collapse,
  DatePicker,
  Descriptions,
  Drawer,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as auditApi from '../services/audit.service'
import type { AuditLog } from '../types/audit'
import { getApiErrorMessage } from '../utils/apiErrorMessage'
import './employees/employees.css'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const TEAL = '#0F5C5E'

const ACTION_OPTIONS = [
  { value: 'LOGIN_SUCCESS', label: 'Connexion réussie' },
  { value: 'LOGIN_FAILED', label: 'Échec de connexion' },
  { value: 'PASSWORD_CHANGED', label: 'Mot de passe modifié' },
  {
    value: 'COMPANY_LEGAL_INFO_UPDATED',
    label: 'Informations légales entreprise',
  },
  { value: 'USER_DEACTIVATED', label: 'Collaborateur désactivé' },
  { value: 'USER_REACTIVATED', label: 'Collaborateur réactivé' },
  { value: 'PAYSLIP_UPLOADED', label: 'Bulletin téléversé' },
  { value: 'PAYSLIP_READ', label: 'Bulletin consulté (marqué lu)' },
  { value: 'PAYSLIP_DELETED', label: 'Bulletin supprimé' },
] as const

const ENTITY_OPTIONS = [
  { value: 'User', label: 'Utilisateur' },
  { value: 'Company', label: 'Entreprise' },
  { value: 'Payslip', label: 'Bulletin' },
] as const

function actionLabel(code: string): string {
  const found = ACTION_OPTIONS.find((o) => o.value === code)
  return found?.label ?? code
}

function entityLabel(type: string): string {
  const found = ENTITY_OPTIONS.find((o) => o.value === type)
  return found?.label ?? type
}

function formatJson(value: unknown): string {
  if (value == null) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function actionTagColor(code: string): string {
  if (code.includes('FAILED')) return 'red'
  if (code === 'PAYSLIP_READ') return 'green'
  return TEAL
}

export function AuditPage() {
  const { message } = App.useApp()
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [actionFilter, setActionFilter] = useState<string | undefined>(
    undefined,
  )
  const [entityFilter, setEntityFilter] = useState<string | undefined>(
    undefined,
  )
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [dataSource, setDataSource] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState<AuditLog | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 400)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, actionFilter, entityFilter, range])

  const fromIso = range?.[0]?.startOf('day').toISOString()
  const toIso = range?.[1]?.endOf('day').toISOString()

  const loadLogs = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await auditApi.getAuditLogs({
        page,
        limit,
        action: actionFilter,
        entityType: entityFilter,
        from: fromIso,
        to: toIso,
        search: debouncedSearch || undefined,
      })
      setDataSource(res.data)
      setTotal(res.meta.total)
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Une erreur est survenue'))
      setDataSource([])
      setTotal(0)
    } finally {
      setListLoading(false)
    }
  }, [
    page,
    limit,
    actionFilter,
    entityFilter,
    fromIso,
    toIso,
    debouncedSearch,
    message,
  ])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const columns: ColumnsType<AuditLog> = useMemo(
    () => [
      {
        title: 'Date / heure',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 168,
        render: (v: string) => (
          <Text style={{ whiteSpace: 'nowrap' }}>
            {dayjs(v).format('DD/MM/YYYY HH:mm:ss')}
          </Text>
        ),
      },
      {
        title: 'Action',
        dataIndex: 'action',
        key: 'action',
        width: 200,
        render: (code: string) => (
          <Tag color={actionTagColor(code)}>{actionLabel(code)}</Tag>
        ),
      },
      {
        title: 'Entité',
        key: 'entity',
        width: 140,
        render: (_, row) => (
          <span>
            <Text type="secondary">{entityLabel(row.entityType)}</Text>
            {row.entityId ? (
              <Text
                copyable={{ text: row.entityId }}
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  marginTop: 2,
                }}
                ellipsis
              >
                {row.entityId.slice(0, 8)}…
              </Text>
            ) : null}
          </span>
        ),
      },
      {
        title: 'Auteur',
        key: 'user',
        ellipsis: true,
        render: (_, row) => {
          if (!row.user) {
            return <Text type="secondary">—</Text>
          }
          return (
            <div>
              <div>
                {row.user.firstName} {row.user.lastName}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {row.user.email}
              </Text>
            </div>
          )
        },
      },
      {
        title: 'IP',
        dataIndex: 'ipAddress',
        key: 'ipAddress',
        width: 120,
        responsive: ['lg'],
        render: (v: string | null) =>
          v ? <Text code>{v}</Text> : <Text type="secondary">—</Text>,
      },
      {
        title: '',
        key: 'detail',
        width: 56,
        fixed: 'right',
        render: (_, row) => (
          <Button
            type="text"
            icon={<EyeOutlined />}
            aria-label="Détails"
            onClick={() => {
              setSelected(row)
              setDrawerOpen(true)
            }}
          />
        ),
      },
    ],
    [],
  )

  return (
    <div>
      <div className="employees-page-header">
        <div>
          <Title level={3} style={{ margin: 0, color: TEAL }}>
            Logs d&apos;audit
          </Title>
          <Text type="secondary">
            Traçabilité des opérations sensibles sur les données de paie.{' '}
            {user?.role === 'SUPER_ADMIN'
              ? 'Vue plateforme : toutes les entreprises.'
              : 'Périmètre : votre entreprise.'}
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void loadLogs()}
          loading={listLoading}
        >
          Actualiser
        </Button>
      </div>

      <Collapse
        ghost
        style={{ marginBottom: 16 }}
        items={[
          {
            key: 'role-journal',
            label: 'Rôle du journal d’audit (contrôle, conformité, sécurité)',
            children: (
              <div
                style={{
                  display: 'grid',
                  gap: 16,
                  maxWidth: 900,
                  fontSize: 14,
                  color: 'rgba(0,0,0,0.75)',
                }}
              >
                <div>
                  <Text strong>Contrôle pour l’administrateur RH</Text>
                  <div style={{ marginTop: 6 }}>
                    Chaque ligne indique <strong>qui</strong> a effectué l’action,{' '}
                    <strong>quand</strong>, et sur <strong>quelle ressource</strong>{' '}
                    (ex. téléversement d’un bulletin pour une période donnée). Plusieurs
                    RH sur la même entreprise : le journal distingue les auteurs. En cas
                    de contestation (« je n’ai pas reçu mon bulletin »), rapprochez le{' '}
                    <strong>téléversement</strong> (action « Bulletin téléversé ») et la{' '}
                    <strong>prise en compte par le collaborateur</strong> (« Bulletin
                    consulté (marqué lu) », avec horodatage dans le détail).
                  </div>
                </div>
                <div>
                  <Text strong>Conformité et données personnelles</Text>
                  <div style={{ marginTop: 6 }}>
                    Les bulletins sont des documents contenant des données salariales. Le
                    RGPD et les référentiels métier attendent une{' '}
                    <strong>traçabilité</strong> des accès et des opérations sur ces
                    données : connexions, consultations marquées comme lues, suppressions,
                    gestion des comptes. Ce journal sert de base documentaire en cas de
                    contrôle ou de litige.
                  </div>
                </div>
                <div>
                  <Text strong>Sécurité et détection</Text>
                  <div style={{ marginTop: 6 }}>
                    Les schémas inhabituels (échecs de connexion répétés, suppressions ou
                    dépôts à des heures atypiques, enchaînements d’actions sur la même
                    période) peuvent signaler un compte compromis ou une erreur humaine.
                    Croisez les colonnes <strong>IP</strong>, <strong>auteur</strong> et{' '}
                    <strong>date</strong> pour analyser un incident.
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />

      <Card styles={{ body: { paddingBottom: 12 } }}>
        <Space wrap size="middle" style={{ width: '100%', marginBottom: 16 }}>
          <Input
            allowClear
            placeholder="Rechercher (e-mail, nom, action, id…)"
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ minWidth: 260, maxWidth: 360 }}
          />
          <Select
            allowClear
            placeholder="Action"
            options={[...ACTION_OPTIONS]}
            value={actionFilter}
            onChange={(v) => setActionFilter(v)}
            style={{ width: 220 }}
          />
          <Select
            allowClear
            placeholder="Type d’entité"
            options={[...ENTITY_OPTIONS]}
            value={entityFilter}
            onChange={(v) => setEntityFilter(v)}
            style={{ width: 160 }}
          />
          <RangePicker
            value={range}
            onChange={(d) => setRange(d)}
            format="DD/MM/YYYY"
          />
        </Space>

        <Table<AuditLog>
          rowKey="id"
          loading={listLoading}
          columns={columns}
          dataSource={dataSource}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => `${t} entrée(s)`,
            onChange: (p, ps) => {
              setPage(p)
              setLimit(ps)
            },
          }}
        />
      </Card>

      <Drawer
        title="Détail du journal"
        width={480}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelected(null)
        }}
      >
        {selected ? (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Date">
                {dayjs(selected.createdAt).format('DD/MM/YYYY HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Action">
                <Tag color={actionTagColor(selected.action)}>
                  {actionLabel(selected.action)}
                </Tag>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({selected.action})
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Entité">
                {entityLabel(selected.entityType)} ({selected.entityType})
              </Descriptions.Item>
              <Descriptions.Item label="ID entité">
                {selected.entityId ? (
                  <Text copyable>{selected.entityId}</Text>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Auteur">
                {selected.user ? (
                  <>
                    {selected.user.firstName} {selected.user.lastName}
                    <br />
                    <Text type="secondary">{selected.user.email}</Text>
                    <br />
                    <Tag>{selected.user.role}</Tag>
                  </>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Adresse IP">
                {selected.ipAddress ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="User-Agent">
                <Text style={{ wordBreak: 'break-word' }}>
                  {selected.userAgent ?? '—'}
                </Text>
              </Descriptions.Item>
            </Descriptions>
            <Title level={5} style={{ marginTop: 24 }}>
              Métadonnées (JSON)
            </Title>
            <pre
              style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                maxHeight: 320,
                overflow: 'auto',
                margin: 0,
              }}
            >
              {formatJson(selected.metadata)}
            </pre>
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
