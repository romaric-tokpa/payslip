import {
  DeleteOutlined,
  EyeOutlined,
  PartitionOutlined,
  TableOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  App,
  Avatar,
  Button,
  Collapse,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as employeesApi from '../services/employees.service'
import * as payslipsApi from '../services/payslips.service'
import type { EmployeeUser } from '../types/employees'
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
import { PayslipsKanban } from './payslips/PayslipsKanban'

const TEAL = '#0F5C5E'

type PayslipsViewMode = 'list' | 'kanban'

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
            >
              {payslipUserInitials(row.user)}
            </Avatar>
            <span>
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
        title: 'Actions',
        key: 'actions',
        width: 140,
        fixed: 'right',
        render: (_, row) => (
          <Space size="small">
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
    [openingId, openPdf, confirmDelete],
  )

  const collapseItems = useMemo(
    () =>
      groupedByPayMonth.map((g) => ({
        key: String(g.sortKey),
        label: (
          <Space size="middle" wrap>
            <strong>{g.title}</strong>
            <Tag color="processing">
              {g.rows.length} bulletin{g.rows.length > 1 ? 's' : ''}
            </Tag>
          </Space>
        ),
        children: (
          <Table<Payslip>
            className="payslips-month-table"
            rowKey="id"
            columns={columns}
            dataSource={g.rows}
            loading={false}
            pagination={false}
            scroll={{ x: 880 }}
            size="middle"
          />
        ),
      })),
    [groupedByPayMonth, columns],
  )

  return (
    <div>
      <PageHeader
        actions={
          <Space wrap>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              style={{ backgroundColor: TEAL }}
              onClick={() => navigate('/payslips/upload')}
            >
              Importer des bulletins
            </Button>
          </Space>
        }
      />

      <div className="employees-filters">
        <Select
          allowClear
          placeholder="Année"
          style={{ width: 110 }}
          value={year}
          onChange={(v) => setYear(v ?? undefined)}
          options={yearOptions().map((y) => ({ value: y, label: String(y) }))}
        />
        <Select
          allowClear
          placeholder="Mois"
          style={{ minWidth: 140 }}
          value={month}
          onChange={(v) => setMonth(v ?? undefined)}
          options={MONTH_OPTIONS}
        />
        <Select
          showSearch
          allowClear
          placeholder="Collaborateur"
          style={{ minWidth: 280, flex: 1, maxWidth: 420 }}
          filterOption={false}
          loading={optionsLoading}
          value={filterUserId}
          onSearch={setSearchInput}
          onChange={(v) => setUserIdFilter(v ?? undefined)}
          options={mergedEmployeeSelectOptions}
          notFoundContent={optionsLoading ? undefined : null}
        />
        <Button onClick={resetFilters}>Réinitialiser</Button>
        <Space size={8} wrap>
          <Tag color="processing">{total} bulletin(s)</Tag>
          {groupedByPayMonth.length > 0 ? (
            <Tag>{groupedByPayMonth.length} mois</Tag>
          ) : null}
          {truncated ? <Tag color="warning">Liste tronquée</Tag> : null}
        </Space>
      </div>

      <div className="employees-view-toggle-wrap">
        <Segmented<PayslipsViewMode>
          value={viewMode}
          onChange={setViewMode}
          options={[
            {
              label: (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <TableOutlined />
                  Liste
                </span>
              ),
              value: 'list',
            },
            {
              label: (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
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
          />
        ) : listLoading ? (
          <Table<Payslip>
            rowKey="id"
            columns={columns}
            dataSource={[]}
            loading
            pagination={false}
          />
        ) : groupedByPayMonth.length === 0 ? (
          <Table<Payslip>
            rowKey="id"
            columns={columns}
            dataSource={[]}
            loading={false}
            pagination={false}
            locale={{ emptyText: 'Aucun bulletin pour ces critères.' }}
          />
        ) : (
          <Collapse
            key={`pc-${filterUserId ?? 'all'}-${year ?? 'y'}-${month ?? 'm'}`}
            bordered={false}
            defaultActiveKey={collapseDefaultKeys}
            items={collapseItems}
          />
        )}
      </div>
    </div>
  )
}
