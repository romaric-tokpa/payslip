import { DeleteOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as employeesApi from '../services/employees.service'
import * as payslipsApi from '../services/payslips.service'
import type { EmployeeUser } from '../types/employees'
import type { Payslip } from '../types/payslips'
import { getApiErrorMessage } from '../utils/apiErrorMessage'
import {
  MONTHS_FR,
  formatEmployeeOption,
  yearOptions,
} from './payslips/payslipUploadConstants'
import './employees/employees.css'

const { Title } = Typography
const TEAL = '#0F5C5E'

function formatFileSize(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
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

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [year, setYear] = useState<number | undefined>(undefined)
  const [month, setMonth] = useState<number | undefined>(undefined)

  const [dataSource, setDataSource] = useState<Payslip[]>([])
  const [total, setTotal] = useState(0)
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
    setPage(1)
  }, [filterUserId, year, month])

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
      const res = await payslipsApi.getPayslips({
        page,
        limit,
        userId: filterUserId,
        year,
        month,
      })
      setDataSource(res.data)
      setTotal(res.meta.total)
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les bulletins de paie'),
      )
      setDataSource([])
      setTotal(0)
    } finally {
      setListLoading(false)
    }
  }, [page, limit, filterUserId, year, month, message])

  useEffect(() => {
    void loadPayslips()
  }, [loadPayslips])

  async function openPdf(row: Payslip) {
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
  }

  function confirmDelete(row: Payslip) {
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
  }

  function resetFilters() {
    setYear(undefined)
    setMonth(undefined)
    setUserIdFilter(undefined)
    setSearchInput('')
  }

  const columns: ColumnsType<Payslip> = [
    {
      title: 'Collaborateur',
      key: 'name',
      render: (_, row) => (
        <span>
          {row.user.lastName} {row.user.firstName}
        </span>
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
      width: 160,
      render: (_, row) => {
        const m = MONTHS_FR[row.periodMonth - 1] ?? String(row.periodMonth)
        return `${m} ${row.periodYear}`
      },
    },
    {
      title: 'Taille',
      key: 'size',
      width: 90,
      render: (_, row) => formatFileSize(row.fileSize),
    },
    {
      title: 'Déposé le',
      key: 'uploadedAt',
      width: 130,
      render: (_, row) => dayjs(row.uploadedAt).format('DD/MM/YYYY HH:mm'),
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
            onClick={() => void openPdf(row)}
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
  ]

  return (
    <div>
      <div className="employees-page-header">
        <Title level={3} style={{ margin: 0 }}>
          Bulletins de paie
        </Title>
        <Space wrap className="employees-toolbar-actions">
          <Button
            type="primary"
            icon={<UploadOutlined />}
            style={{ backgroundColor: TEAL }}
            onClick={() => navigate('/payslips/upload')}
          >
            Importer des bulletins
          </Button>
        </Space>
      </div>

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
        <Tag color="processing">{total} bulletin(s)</Tag>
      </div>

      <Table<Payslip>
        rowKey="id"
        columns={columns}
        dataSource={dataSource}
        loading={listLoading}
        scroll={{ x: 960 }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (t) => `${t} bulletin(s)`,
        }}
        onChange={(pag, _f, _s, extra) => {
          if (extra.action !== 'paginate') {
            return
          }
          if (pag.current != null) {
            setPage(pag.current)
          }
          if (pag.pageSize != null) {
            setLimit(pag.pageSize)
          }
        }}
      />
    </div>
  )
}
