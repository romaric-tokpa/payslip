import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  PartitionOutlined,
  TableOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Avatar,
  Button,
  Collapse,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ADMIN_BASE } from '../constants/adminRoutes'
import * as employeesApi from '../services/employees.service'
import * as payslipsApi from '../services/payslips.service'
import type { EmployeeUser } from '../types/employees'
import type { VerifySignatureResponse } from '../types/payslip-signatures'
import type { Payslip } from '../types/payslips'
import { PageHeader } from '../components/PageHeader'
import { getApiErrorMessage } from '../utils/apiErrorMessage'
import {
  MONTHS_FR,
  formatEmployeeOption,
  yearOptions,
} from './payslips/payslipUploadConstants'
import './employees/employees.css'
import './payslips/payslips-list.css'
import { PayslipSignaturesSection } from './payslips/PayslipSignaturesSection'
import { PayslipsKanban } from './payslips/PayslipsKanban'

type PayslipsViewMode = 'list' | 'kanban'
type PayslipsMainTab = 'bulletins' | 'signatures'

/** Taille de page API pour tout charger avant regroupement par mois de paie. */
const FETCH_PAGE_SIZE = 100
const MAX_FETCH_PAGES = 40

function payslipUserInitials(u: Payslip['user']): string {
  const a = u.firstName?.trim()?.[0] ?? ''
  const b = u.lastName?.trim()?.[0] ?? ''
  const pair = `${b}${a}`.toUpperCase()
  return pair.length > 0 ? pair : '?'
}

function formatFileSize(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

function periodSortKey(year: number, month: number): number {
  return year * 100 + month
}

function formatPayPeriodTitle(month: number, year: number): string {
  const label = MONTHS_FR[month - 1] ?? String(month)
  const cap = label.charAt(0).toUpperCase() + label.slice(1)
  return `${cap} ${year}`
}

type MonthGroup = {
  sortKey: number
  periodMonth: number
  periodYear: number
  title: string
  rows: Payslip[]
}

const MONTH_OPTIONS = MONTHS_FR.map((label, i) => ({
  value: i + 1,
  label,
}))

export function PayslipsPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const filterUserId = searchParams.get('userId') || undefined

  const [year, setYear] = useState<number | undefined>(undefined)
  const [month, setMonth] = useState<number | undefined>(undefined)

  const [dataSource, setDataSource] = useState<Payslip[]>([])
  const [total, setTotal] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [listLoading, setListLoading] = useState(true)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [employeeOptions, setEmployeeOptions] = useState<
    { value: string; label: string }[]
  >([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [pinnedEmployeeOption, setPinnedEmployeeOption] = useState<{
    value: string
    label: string
  } | null>(null)

  const [openingId, setOpeningId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<PayslipsViewMode>('list')
  const [mainTab, setMainTab] = useState<PayslipsMainTab>('bulletins')

  const [sigVerifyOpen, setSigVerifyOpen] = useState(false)
  const [sigVerifyCode, setSigVerifyCode] = useState('')
  const [sigVerifyLoading, setSigVerifyLoading] = useState(false)
  const [sigVerifyResult, setSigVerifyResult] =
    useState<VerifySignatureResponse | null>(null)

  useEffect(() => {
    const st = location.state as { tab?: string } | undefined
    if (st?.tab === 'signatures') {
      setMainTab('signatures')
    }
  }, [location.state])

  function setUserIdFilter(next: string | undefined) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next) {
          p.set('userId', next)
        } else {
          p.delete('userId')
        }
        return p
      },
      { replace: true },
    )
  }

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (!filterUserId) {
      setPinnedEmployeeOption(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const u = await employeesApi.getEmployeeById(filterUserId)
        if (!cancelled) {
          setPinnedEmployeeOption({
            value: u.id,
            label: formatEmployeeOption(u),
          })
        }
      } catch {
        if (!cancelled) {
          setPinnedEmployeeOption({
            value: filterUserId,
            label: filterUserId,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filterUserId])

  const loadEmployeeOptions = useCallback(async (search: string) => {
    setOptionsLoading(true)
    try {
      const res = await employeesApi.getEmployees({
        search: search === '' ? undefined : search,
        limit: 50,
        page: 1,
      })
      setEmployeeOptions(
        res.data.map((u: EmployeeUser) => ({
          value: u.id,
          label: formatEmployeeOption(u),
        })),
      )
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les collaborateurs'),
      )
      setEmployeeOptions([])
    } finally {
      setOptionsLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadEmployeeOptions(debouncedSearch)
  }, [debouncedSearch, loadEmployeeOptions])

  const mergedEmployeeSelectOptions = useMemo(() => {
    const map = new Map<string, string>()
    if (pinnedEmployeeOption) {
      map.set(pinnedEmployeeOption.value, pinnedEmployeeOption.label)
    }
    for (const o of employeeOptions) {
      map.set(o.value, o.label)
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }))
  }, [pinnedEmployeeOption, employeeOptions])

  const loadPayslips = useCallback(async () => {
    setListLoading(true)
    try {
      const acc: Payslip[] = []
      let totalCount = 0
      let hitCap = false
      for (let pageNum = 1; pageNum <= MAX_FETCH_PAGES; pageNum += 1) {
        const res = await payslipsApi.getPayslips({
          page: pageNum,
          limit: FETCH_PAGE_SIZE,
          userId: filterUserId,
          year,
          month,
        })
        totalCount = res.meta.total
        acc.push(...res.data)
        if (acc.length >= totalCount || res.data.length === 0) {
          break
        }
        if (pageNum === MAX_FETCH_PAGES && acc.length < totalCount) {
          hitCap = true
          break
        }
      }
      setDataSource(acc)
      setTotal(totalCount)
      setTruncated(hitCap)
      if (hitCap) {
        message.warning(
          `Affichage partiel : ${acc.length} bulletin(s) sur ${totalCount} (limite de chargement). Affinez les filtres pour voir le reste.`,
        )
      }
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les bulletins de paie'),
      )
      setDataSource([])
      setTotal(0)
      setTruncated(false)
    } finally {
      setListLoading(false)
    }
  }, [filterUserId, year, month, message])

  useEffect(() => {
    void loadPayslips()
  }, [loadPayslips])

  const groupedByPayMonth = useMemo((): MonthGroup[] => {
    const map = new Map<number, Payslip[]>()
    for (const p of dataSource) {
      const k = periodSortKey(p.periodYear, p.periodMonth)
      const list = map.get(k) ?? []
      list.push(p)
      map.set(k, list)
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          dayjs(b.uploadedAt).valueOf() - dayjs(a.uploadedAt).valueOf(),
      )
    }
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([sortKey, rows]) => {
        const first = rows[0]!
        return {
          sortKey,
          periodMonth: first.periodMonth,
          periodYear: first.periodYear,
          title: formatPayPeriodTitle(first.periodMonth, first.periodYear),
          rows,
        }
      })
  }, [dataSource])

  const collapseDefaultKeys = useMemo(() => {
    const keys = groupedByPayMonth.map((g) => String(g.sortKey))
    if (keys.length <= 24) {
      return keys
    }
    return keys.slice(0, 12)
  }, [groupedByPayMonth])

  const openPdf = useCallback(
    async (row: Payslip) => {
      setOpeningId(row.id)
      try {
        const detail = await payslipsApi.getPayslipById(row.id)
        if (detail.presignedUrl) {
          window.open(detail.presignedUrl, '_blank', 'noopener,noreferrer')
        }
      } catch (e) {
        message.error(
          getApiErrorMessage(e, "Impossible d'ouvrir le bulletin"),
        )
      } finally {
        setOpeningId(null)
      }
    },
    [message],
  )

  const openSigVerify = useCallback((code: string) => {
    setSigVerifyCode(code.replace(/\s/g, '').toUpperCase())
    setSigVerifyResult(null)
    setSigVerifyOpen(true)
  }, [])

  const closeSigVerify = useCallback(() => {
    setSigVerifyOpen(false)
    setSigVerifyResult(null)
    setSigVerifyCode('')
  }, [])

  const runSigVerify = useCallback(async () => {
    const c = sigVerifyCode.replace(/\s/g, '').toUpperCase()
    if (c.length < 12) {
      message.warning('Saisissez le code sur 12 caractères (0-9, A-F).')
      return
    }
    setSigVerifyLoading(true)
    setSigVerifyResult(null)
    try {
      const data = await payslipsApi.verifyPayslipSignaturePublic(c)
      setSigVerifyResult(data)
      if (!data.valid) {
        message.info('Code de vérification non trouvé.')
      }
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Vérification impossible'))
    } finally {
      setSigVerifyLoading(false)
    }
  }, [sigVerifyCode, message])

  const downloadSignatureCert = useCallback(
    async (signatureId: string) => {
      try {
        await payslipsApi.downloadSignatureCertificate(signatureId)
        message.success('Certificat téléchargé')
      } catch (e) {
        message.error(getApiErrorMessage(e, 'Téléchargement impossible'))
      }
    },
    [message],
  )

  const confirmDelete = useCallback(
    (row: Payslip) => {
      modal.confirm({
        title: 'Supprimer ce bulletin ?',
        content:
          'Le fichier sera retiré du stockage. Cette action est irréversible.',
        okText: 'Supprimer',
        okType: 'danger',
        cancelText: 'Annuler',
        onOk: async () => {
          try {
            await payslipsApi.deletePayslip(row.id)
            message.success('Bulletin supprimé')
            await loadPayslips()
          } catch (e) {
            message.error(
              getApiErrorMessage(e, 'La suppression a échoué'),
            )
            throw e
          }
        },
      })
    },
    [modal, message, loadPayslips],
  )

  function resetFilters() {
    setYear(undefined)
    setMonth(undefined)
    setUserIdFilter(undefined)
    setSearchInput('')
  }

  const columns: ColumnsType<Payslip> = useMemo(
    () => [
      {
        title: 'Collaborateur',
        key: 'name',
        render: (_, row) => (
          <Space size={12} align="center">
            <Avatar
              size={40}
              src={row.user.profilePhotoUrl || undefined}
              alt=""
              className="payslips-table-avatar"
            >
              {payslipUserInitials(row.user)}
            </Avatar>
            <span className="payslips-table-name">
              {row.user.lastName} {row.user.firstName}
            </span>
          </Space>
        ),
      },
      {
        title: 'Matricule',
        key: 'matricule',
        width: 120,
        render: (_, row) => row.user.employeeId?.trim() || '—',
      },
      {
        title: 'Département',
        key: 'dept',
        ellipsis: true,
        render: (_, row) => row.user.department?.trim() || '—',
      },
      {
        title: 'Période',
        key: 'period',
        width: 88,
        render: (_, row) =>
          `${String(row.periodMonth).padStart(2, '0')}/${row.periodYear}`,
      },
      {
        title: 'Taille',
        key: 'size',
        width: 90,
        render: (_, row) => formatFileSize(row.fileSize),
      },
      {
        title: 'Envoyé le',
        key: 'uploadedAt',
        width: 150,
        render: (_, row) =>
          dayjs(row.uploadedAt).format('DD/MM/YYYY HH:mm'),
      },
      {
        title: 'Lu',
        key: 'read',
        width: 80,
        align: 'center',
        render: (_, row) =>
          row.isRead ? (
            <Tag color="success">Oui</Tag>
          ) : (
            <Tag>Non</Tag>
          ),
      },
      {
        title: 'Signé',
        key: 'signed',
        width: 88,
        align: 'center',
        render: (_, row) =>
          row.isSigned ? (
            <Tag color="success">Oui</Tag>
          ) : (
            <Tag>Non</Tag>
          ),
      },
      {
        title: 'Code accusé',
        key: 'sigCode',
        width: 156,
        render: (_, row) =>
          row.signature ? (
            <Typography.Text
              copyable={{ text: row.signature.verificationCode }}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            >
              {row.signature.verificationCode}
            </Typography.Text>
          ) : (
            <span style={{ color: '#bfbfbf' }}>—</span>
          ),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 260,
        fixed: 'right',
        render: (_, row) => (
          <Space size="small" wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              loading={openingId === row.id}
              onClick={() => {
                void openPdf(row)
              }}
            >
              Voir
            </Button>
            <Button
              type="link"
              size="small"
              disabled={!row.signature?.verificationCode}
              onClick={() =>
                openSigVerify(row.signature?.verificationCode ?? '')
              }
            >
              Vérifier
            </Button>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              disabled={!row.signature?.id}
              onClick={() =>
                void downloadSignatureCert(row.signature!.id)
              }
            >
              Certificat
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => confirmDelete(row)}
            >
              Supprimer
            </Button>
          </Space>
        ),
      },
    ],
    [
      openingId,
      openPdf,
      confirmDelete,
      openSigVerify,
      downloadSignatureCert,
    ],
  )

  const collapseItems = useMemo(
    () =>
      groupedByPayMonth.map((g) => ({
        key: String(g.sortKey),
        label: (
          <div className="payslips-collapse-header">
            <span className="payslips-collapse-header__title">{g.title}</span>
            <Tag className="payslips-collapse-header__count">
              {g.rows.length} bulletin{g.rows.length > 1 ? 's' : ''}
            </Tag>
          </div>
        ),
        children: (
          <Table<Payslip>
            className="payslips-month-table"
            rowKey="id"
            columns={columns}
            dataSource={g.rows}
            loading={false}
            pagination={false}
            scroll={{ x: 1120 }}
            size="middle"
          />
        ),
      })),
    [groupedByPayMonth, columns],
  )

  return (
    <div className="payslips-page">
      <PageHeader
        actions={
          <Space wrap>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              className="employees-btn-primary-teal"
              onClick={() => navigate(`${ADMIN_BASE}/payslips/upload`)}
            >
              Importer des bulletins
            </Button>
          </Space>
        }
      />

      <p className="payslips-page-lead">
        Chaque bulletin correspond à <strong>un mois</strong> pour{' '}
        <strong>un collaborateur</strong> : après signature sur l’app, un{' '}
        <strong>code de vérification</strong> unique est attaché à ce couple
        mois / personne. Filtrez par période ou par collaborateur, copiez le code,
        vérifiez depuis cette page ou la page publique <strong>/verify</strong>, et
        téléchargez le certificat PDF. Vue globale des signatures dans l’onglet
        dédié.
      </p>

      <div className="employees-view-panel payslips-main-tab-panel">
        <span className="employees-view-panel__label">Vue</span>
        <Segmented<PayslipsMainTab>
          value={mainTab}
          onChange={setMainTab}
          options={[
            { label: 'Bulletins', value: 'bulletins' },
            { label: 'Signatures', value: 'signatures' },
          ]}
          className="employees-view-toggle"
        />
      </div>

      {mainTab === 'signatures' ? (
        <PayslipSignaturesSection />
      ) : null}

      {mainTab === 'bulletins' ? (
        <>
      {filterUserId ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Vue par collaborateur"
          description={
            <>
              Chaque ligne est un <strong>mois de paie</strong> pour cette
              personne. Le code d’accusé permet de contrôler la signature
              enregistrée pour ce mois précis. Utilisez <strong>Vérifier</strong>{' '}
              pour interroger le registre (équivalent à la page publique de
              vérification).
            </>
          }
        />
      ) : null}
      <section className="payslips-toolbar" aria-label="Filtres bulletins">
        <div className="payslips-toolbar__filters">
          <Select
            allowClear
            className="employees-filter-select payslips-filter-year"
            placeholder="Année"
            value={year}
            onChange={(v) => setYear(v ?? undefined)}
            options={yearOptions().map((y) => ({ value: y, label: String(y) }))}
          />
          <Select
            allowClear
            className="employees-filter-select payslips-filter-month"
            placeholder="Mois"
            value={month}
            onChange={(v) => setMonth(v ?? undefined)}
            options={MONTH_OPTIONS}
          />
          <Select
            showSearch
            allowClear
            className="employees-filter-select payslips-filter-employee"
            placeholder="Collaborateur"
            filterOption={false}
            loading={optionsLoading}
            value={filterUserId}
            onSearch={setSearchInput}
            onChange={(v) => setUserIdFilter(v ?? undefined)}
            options={mergedEmployeeSelectOptions}
            notFoundContent={optionsLoading ? undefined : null}
          />
          <Button className="payslips-reset-filters" onClick={resetFilters}>
            Réinitialiser
          </Button>
        </div>
        <div className="payslips-toolbar__stats">
          <Tag className="payslips-stat-tag payslips-stat-tag--primary">
            {total} bulletin{total === 1 ? '' : 's'}
          </Tag>
          {groupedByPayMonth.length > 0 ? (
            <Tag className="payslips-stat-tag">
              {groupedByPayMonth.length} mois affiché
              {groupedByPayMonth.length > 1 ? 's' : ''}
            </Tag>
          ) : null}
          {truncated ? (
            <Tag className="payslips-stat-tag payslips-stat-tag--warning">
              Liste tronquée — affinez les filtres
            </Tag>
          ) : null}
        </div>
      </section>

      <div className="employees-view-panel payslips-view-panel">
        <span className="employees-view-panel__label">Affichage</span>
        <Segmented<PayslipsViewMode>
          value={viewMode}
          onChange={setViewMode}
          options={[
            {
              label: (
                <span className="employees-segment-label">
                  <TableOutlined />
                  Liste par mois
                </span>
              ),
              value: 'list',
            },
            {
              label: (
                <span className="employees-segment-label">
                  <PartitionOutlined />
                  Kanban
                </span>
              ),
              value: 'kanban',
            },
          ]}
          className="employees-view-toggle"
        />
      </div>

      <div className="payslips-by-month">
        {viewMode === 'kanban' ? (
          <PayslipsKanban
            groups={groupedByPayMonth}
            loading={listLoading}
            openingId={openingId}
            onOpenPdf={openPdf}
            onDelete={confirmDelete}
            onVerifySignature={(row) =>
              openSigVerify(row.signature?.verificationCode ?? '')
            }
            onDownloadCertificate={(row) => {
              if (row.signature?.id) {
                void downloadSignatureCert(row.signature.id)
              }
            }}
          />
        ) : listLoading ? (
          <div className="payslips-table-shell">
            <Table<Payslip>
              rowKey="id"
              className="payslips-main-table"
              columns={columns}
              dataSource={[]}
              loading
              pagination={false}
            />
          </div>
        ) : groupedByPayMonth.length === 0 ? (
          <div className="payslips-table-shell">
            <Table<Payslip>
              rowKey="id"
              className="payslips-main-table"
              columns={columns}
              dataSource={[]}
              loading={false}
              pagination={false}
              locale={{ emptyText: 'Aucun bulletin pour ces critères.' }}
            />
          </div>
        ) : (
          <Collapse
            className="payslips-collapse"
            key={`pc-${filterUserId ?? 'all'}-${year ?? 'y'}-${month ?? 'm'}`}
            bordered={false}
            defaultActiveKey={collapseDefaultKeys}
            items={collapseItems}
          />
        )}
      </div>
        </>
      ) : null}

      <Modal
        title="Vérifier un accusé de réception"
        open={sigVerifyOpen}
        onCancel={closeSigVerify}
        destroyOnHidden
        footer={[
          <Button key="close" onClick={closeSigVerify}>
            Fermer
          </Button>,
          <Button
            key="run"
            type="primary"
            loading={sigVerifyLoading}
            onClick={() => void runSigVerify()}
          >
            Vérifier
          </Button>,
        ]}
        width={520}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Même contrôle que la page publique : le code est lié au bulletin signé
          pour le mois indiqué dans le résultat.
        </Typography.Paragraph>
        <label className="payslips-verify-modal-label" htmlFor="rh-sig-code">
          Code (12 caractères)
        </label>
        <Input
          id="rh-sig-code"
          placeholder="Ex. A1B2C3D4E5F6"
          maxLength={14}
          value={sigVerifyCode}
          onChange={(e) =>
            setSigVerifyCode(
              e.target.value.toUpperCase().replace(/[^0-9A-F]/gi, ''),
            )
          }
          onPressEnter={() => void runSigVerify()}
          style={{ fontFamily: 'monospace', marginBottom: 16 }}
        />
        {sigVerifyResult?.valid === true && sigVerifyResult.details ? (
          <div className="payslips-verify-modal-ok">
            <div className="payslips-verify-modal-ok-head">
              <CheckCircleOutlined className="payslips-verify-modal-ok-icon" />
              <Tag color="success">Signature valide</Tag>
            </div>
            <dl className="payslips-verify-modal-dl">
              <dt>Collaborateur</dt>
              <dd>{sigVerifyResult.details.employeeName}</dd>
              <dt>Matricule</dt>
              <dd>{sigVerifyResult.details.employeeId || '—'}</dd>
              <dt>Entreprise</dt>
              <dd>{sigVerifyResult.details.companyName}</dd>
              <dt>Période (mois de paie)</dt>
              <dd>{sigVerifyResult.details.period}</dd>
              <dt>Date de signature</dt>
              <dd>
                {new Date(sigVerifyResult.details.signedAt).toLocaleString(
                  'fr-FR',
                  { timeZone: 'Africa/Abidjan' },
                )}
              </dd>
              <dt>Empreinte SHA-256</dt>
              <dd className="payslips-verify-modal-hash">
                {sigVerifyResult.details.fileHash}
              </dd>
            </dl>
          </div>
        ) : null}
        {sigVerifyResult?.valid === false ? (
          <div className="payslips-verify-modal-err" role="alert">
            <CloseCircleOutlined /> Aucune signature enregistrée pour ce code.
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
