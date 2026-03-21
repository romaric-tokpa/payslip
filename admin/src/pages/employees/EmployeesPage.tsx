import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as employeesApi from '../../services/employees.service'
import type { EmployeeUser } from '../../types/employees'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { EmployeeFormModal } from './EmployeeFormModal'
import { EmployeeTable } from './EmployeeTable'
import { ImportModal } from './ImportModal'
import './employees.css'

const { Title } = Typography
const TEAL = '#0F5C5E'

export function EmployeesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>(
    undefined,
  )
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([])

  const [dataSource, setDataSource] = useState<EmployeeUser[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingEmployee, setEditingEmployee] = useState<EmployeeUser | null>(
    null,
  )

  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 400)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, departmentFilter])

  const loadEmployees = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await employeesApi.getEmployees({
        page,
        limit,
        search: debouncedSearch || undefined,
        department: departmentFilter,
      })
      setDataSource(res.data)
      setTotal(res.meta.total)
      setDepartmentOptions((prev) => {
        const next = new Set(prev)
        for (const u of res.data) {
          if (u.department) {
            next.add(u.department)
          }
        }
        return Array.from(next).sort((a, b) => a.localeCompare(b, 'fr'))
      })
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les collaborateurs'),
      )
    } finally {
      setListLoading(false)
    }
  }, [page, limit, debouncedSearch, departmentFilter])

  useEffect(() => {
    void loadEmployees()
  }, [loadEmployees])

  function openCreateModal() {
    setFormMode('create')
    setEditingEmployee(null)
    setFormOpen(true)
  }

  function openEditModal(row: EmployeeUser) {
    setFormMode('edit')
    setEditingEmployee(row)
    setFormOpen(true)
  }

  async function handleDownloadTemplate() {
    try {
      await employeesApi.downloadTemplate()
      message.success('Modèle téléchargé')
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Échec du téléchargement'))
    }
  }

  function confirmDeactivate(row: EmployeeUser) {
    Modal.confirm({
      title: 'Désactiver ce collaborateur ?',
      content:
        "Le compte ne pourra plus se connecter tant qu'il n'est pas réactivé. Cette action est réversible.",
      okText: 'Désactiver',
      okType: 'danger',
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          await employeesApi.deactivateEmployee(row.id)
          message.success('Collaborateur désactivé')
          await loadEmployees()
        } catch (e) {
          message.error(
            getApiErrorMessage(e, 'La désactivation a échoué'),
          )
          throw e
        }
      },
    })
  }

  async function handleReactivate(row: EmployeeUser) {
    setListLoading(true)
    try {
      await employeesApi.reactivateEmployee(row.id)
      message.success('Collaborateur réactivé')
      await loadEmployees()
    } catch (e) {
      message.error(getApiErrorMessage(e, 'La réactivation a échoué'))
    } finally {
      setListLoading(false)
    }
  }

  return (
    <div>
      <div className="employees-page-header">
        <Title level={3} style={{ margin: 0 }}>
          Collaborateurs
        </Title>
        <Space wrap className="employees-toolbar-actions">
          <Button
            variant="outlined"
            onClick={() => void handleDownloadTemplate()}
          >
            Télécharger le template CSV
          </Button>
          <Button
            variant="outlined"
            icon={<UploadOutlined />}
            onClick={() => setImportOpen(true)}
          >
            Importer CSV/Excel
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ backgroundColor: TEAL }}
            onClick={openCreateModal}
          >
            Ajouter un collaborateur
          </Button>
        </Space>
      </div>

      <div className="employees-filters">
        <Input.Search
          allowClear
          placeholder="Rechercher par nom, prénom ou matricule..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          allowClear
          placeholder="Tous les départements"
          style={{ minWidth: 200 }}
          value={departmentFilter}
          onChange={(v) => setDepartmentFilter(v)}
          options={departmentOptions.map((d) => ({ label: d, value: d }))}
        />
        <Tag color="processing">{total} résultat(s)</Tag>
      </div>

      <EmployeeTable
        dataSource={dataSource}
        loading={listLoading}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (t) => `${t} collaborateur(s)`,
        }}
        onChange={(pag, _filters, _sorter, extra) => {
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
        onEdit={openEditModal}
        onDeactivate={confirmDeactivate}
        onReactivate={(row) => void handleReactivate(row)}
        onViewPayslips={(userId) => {
          navigate(`/payslips?userId=${encodeURIComponent(userId)}`)
        }}
      />

      <EmployeeFormModal
        open={formOpen}
        mode={formMode}
        employee={editingEmployee}
        onClose={() => {
          setFormOpen(false)
          setEditingEmployee(null)
        }}
        onSuccess={(result) => {
          void loadEmployees()
          if (result.kind === 'create') {
            message.success(`Invitation envoyée à ${result.email}`)
          } else {
            message.success('Collaborateur mis à jour')
          }
        }}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImportSuccess={() => void loadEmployees()}
      />
    </div>
  )
}
