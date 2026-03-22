import { DownloadOutlined } from '@ant-design/icons'
import { App, Button, Card, DatePicker, Select, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import * as auditApi from '../../services/audit.service'
import * as superAdminApi from '../../services/super-admin.service'
import type { AuditLog } from '../../types/audit'
import type { GlobalAuditLogRow } from '../../types/super-admin'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { formatAuditDetail } from '../audit/auditDetail'
import '../employees/employees.css'
import '../audit/audit.css'
import './superAdminPages.css'

const { RangePicker } = DatePicker

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Connexion réussie',
  LOGIN_FAILED: 'Échec de connexion',
  PASSWORD_CHANGED: 'Mot de passe modifié',
  COMPANY_LEGAL_INFO_UPDATED: 'Informations légales',
  USER_DEACTIVATED: 'Collaborateur désactivé',
  USER_REACTIVATED: 'Collaborateur réactivé',
  PAYSLIP_UPLOADED: 'Bulletin téléversé',
  PAYSLIP_READ: 'Bulletin consulté',
  PAYSLIP_DELETED: 'Bulletin supprimé',
  USER_INVITED: 'Invitation',
  INVITE: 'Invitation',
  UPLOAD: 'Téléversement',
  DESACTIVE: 'Désactivation',
  REACTIVE: 'Réactivation',
  DELETE: 'Suppression',
  SUPER_ADMIN_IMPERSONATE: 'Impersonation super admin',
}

function actionLabel(code: string): string {
  return ACTION_LABELS[code] ?? code
}

function actionBadgeClass(action: string): string {
  if (action === 'PAYSLIP_UPLOADED') {
    return 'audit-badge audit-badge--teal'
  }
  if (action === 'LOGIN_SUCCESS' || action === 'USER_REACTIVATED') {
    return 'audit-badge audit-badge--green'
  }
  if (
    action === 'LOGIN_FAILED' ||
    action === 'USER_DEACTIVATED' ||
    action === 'PAYSLIP_DELETED'
  ) {
    return 'audit-badge audit-badge--red'
  }
  if (
    action === 'USER_INVITED' ||
    action === 'INVITE' ||
    action.includes('INVITE')
  ) {
    return 'audit-badge audit-badge--orange'
  }
  if (action === 'PAYSLIP_READ') {
    return 'audit-badge audit-badge--green'
  }
  if (action === 'SUPER_ADMIN_IMPERSONATE') {
    return 'audit-badge audit-badge--orange'
  }
  return 'audit-badge audit-badge--muted'
}

export function GlobalAuditPage() {
  const { message } = App.useApp()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [actionFilter, setActionFilter] = useState<string | undefined>()
  const [companyIdFilter, setCompanyIdFilter] = useState<string | undefined>()
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [distinctActions, setDistinctActions] = useState<string[]>([])

  const [companyOptions, setCompanyOptions] = useState<
    { value: string; label: string }[]
  >([])
  const [companiesLoading, setCompaniesLoading] = useState(false)

  const [dataSource, setDataSource] = useState<GlobalAuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void auditApi
      .getAuditActions()
      .then(setDistinctActions)
      .catch(() => {
        setDistinctActions([])
      })
  }, [])

  const loadCompanyOptions = useCallback(async () => {
    setCompaniesLoading(true)
    try {
      const res = await superAdminApi.getSuperAdminCompanies({
        page: 1,
        limit: 500,
        sortBy: 'name',
        sortOrder: 'asc',
      })
      setCompanyOptions(
        res.companies.map((c) => ({ value: c.id, label: c.name })),
      )
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les entreprises'),
      )
      setCompanyOptions([])
    } finally {
      setCompaniesLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadCompanyOptions()
  }, [loadCompanyOptions])

  useEffect(() => {
    setPage(1)
  }, [actionFilter, companyIdFilter, range])

  const fromIso = range?.[0]?.startOf('day').toISOString()
  const toIso = range?.[1]?.endOf('day').toISOString()

  const loadLogs = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await superAdminApi.getGlobalAuditLogs({
        page,
        limit,
        action: actionFilter,
        companyId: companyIdFilter,
        from: fromIso,
        to: toIso,
      })
      setDataSource(res.logs)
      setTotal(res.total)
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Journal indisponible'))
      setDataSource([])
      setTotal(0)
    } finally {
      setListLoading(false)
    }
  }, [
    actionFilter,
    companyIdFilter,
    fromIso,
    limit,
    message,
    page,
    toIso,
  ])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const actionSelectOptions = useMemo(() => {
    const opts = distinctActions.map((a) => ({
      value: a,
      label: actionLabel(a),
    }))
    opts.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
    return opts
  }, [distinctActions])

  async function handleExportCsv() {
    setExporting(true)
    try {
      await auditApi.exportAuditCsv({
        action: actionFilter,
        startDate: fromIso,
        endDate: toIso,
      })
      message.success('Export téléchargé')
    } catch (e) {
      message.error(getApiErrorMessage(e, "Échec de l'export CSV"))
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnsType<GlobalAuditLogRow> = useMemo(
    () => [
      {
        title: 'Date',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 100,
        render: (v: string) => (
          <span className="audit-col-date">
            {dayjs(v).format('DD/MM HH:mm')}
          </span>
        ),
      },
      {
        title: 'Entreprise',
        key: 'company',
        width: 140,
        ellipsis: true,
        render: (_, row) => (
          <span className="audit-col-user">
            {row.company?.name ?? '—'}
          </span>
        ),
      },
      {
        title: 'Action',
        dataIndex: 'action',
        key: 'action',
        width: 160,
        render: (code: string) => (
          <Tag className={actionBadgeClass(code)}>{actionLabel(code)}</Tag>
        ),
      },
      {
        title: 'Détail',
        key: 'detail',
        ellipsis: true,
        render: (_, row) => (
          <span className="audit-col-detail">
            {formatAuditDetail(row as unknown as AuditLog)}
          </span>
        ),
      },
      {
        title: 'Utilisateur',
        key: 'user',
        width: 160,
        ellipsis: true,
        render: (_, row) => {
          if (!row.user) {
            return <span className="audit-col-user">—</span>
          }
          return (
            <span className="audit-col-user">
              {row.user.firstName} {row.user.lastName}
            </span>
          )
        },
      },
      {
        title: 'IP',
        dataIndex: 'ipAddress',
        key: 'ipAddress',
        width: 120,
        render: (v: string | null) => (
          <span className="audit-col-ip">{v ?? '—'}</span>
        ),
      },
    ],
    [],
  )

  return (
    <div className="audit-page">
      <h1 className="sa-page-title">Audit global</h1>
      <p className="sa-page-lead">
        Toutes les entreprises : filtres par période, type d’action et société.
      </p>

      <PageHeader
        actions={
          <Button
            variant="outlined"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={() => void handleExportCsv()}
            className="audit-btn-export"
          >
            Exporter CSV
          </Button>
        }
      />

      <section className="audit-toolbar" aria-label="Filtres du journal">
        <div className="audit-toolbar__filters">
          <RangePicker
            className="audit-range-picker"
            value={range}
            onChange={(d) => setRange(d)}
            format="DD/MM/YYYY"
            allowEmpty={[true, true]}
          />
          <Select
            allowClear
            placeholder="Entreprise"
            className="employees-filter-select audit-filter-action"
            style={{ minWidth: 200 }}
            loading={companiesLoading}
            showSearch
            optionFilterProp="label"
            options={companyOptions}
            value={companyIdFilter}
            onChange={(v) => setCompanyIdFilter(v)}
          />
          <Select
            allowClear
            placeholder="Type d'action"
            className="employees-filter-select audit-filter-action"
            options={actionSelectOptions}
            value={actionFilter}
            onChange={(v) => setActionFilter(v)}
            popupMatchSelectWidth={false}
          />
        </div>
      </section>

      <Card className="audit-table-card" variant="outlined">
        <Table<GlobalAuditLogRow>
          className="audit-table"
          rowKey="id"
          loading={listLoading}
          columns={columns}
          dataSource={dataSource}
          scroll={{ x: 860 }}
          locale={{
            emptyText: (
              <div className="audit-empty">
                Aucune entrée pour ces critères
              </div>
            ),
          }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            size: 'small',
            showTotal: (t) => `${t} entrée(s)`,
            onChange: (p, ps) => {
              setPage(p)
              setLimit(ps)
            },
          }}
        />
      </Card>
    </div>
  )
}
