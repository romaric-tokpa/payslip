import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as employeesApi from '../../services/employees.service'
import * as orgApi from '../../services/organization.service'
import type { EmployeeUser } from '../../types/employees'
import type { OrgDepartment, OrgDirection } from '../../types/organization'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { EmployeeFormModal } from './EmployeeFormModal'
import { EmployeeTable } from './EmployeeTable'
import { ImportModal } from './ImportModal'
import './employees.css'

const { Title, Paragraph } = Typography
const TEAL = '#0F5C5E'

type ActivationCodeModalContentProps = {
  email: string
  activationCode: string
  variant: 'create' | 'regenerate'
}

function ActivationCodeModalContent({
  email,
  activationCode,
  variant,
}: ActivationCodeModalContentProps) {
  return (
    <div>
      {variant === 'create' ? (
        <p>
          Le compte de <strong>{email}</strong> est créé mais inactif jusqu’à
          activation. Communiquez ce code au collaborateur (valide{' '}
          <strong>72 h</strong>). L’envoi automatique par e-mail n’est pas encore
          branché.
        </p>
      ) : (
        <p>
          Un <strong>nouveau</strong> code a été généré pour{' '}
          <strong>{email}</strong>. Les codes d’activation précédents ne sont plus
          valides. Durée de validité : <strong>72 h</strong>.
        </p>
      )}
      <p style={{ marginBottom: 8 }}>Code à saisir dans l’app mobile :</p>
      <Paragraph
        copyable
        style={{
          fontFamily: 'monospace',
          fontSize: 22,
          letterSpacing: '0.2em',
          marginBottom: 0,
        }}
      >
        {activationCode}
      </Paragraph>
      <p style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
        Dans l’app : connexion → « Activer mon compte (code d’activation) » →
        saisir le code (1 à 6 chiffres, zéros de tête optionnels) et un mot de
        passe (8 caractères minimum).
      </p>
    </div>
  )
}

export function EmployeesPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [directionIdFilter, setDirectionIdFilter] = useState<
    string | undefined
  >(undefined)
  const [departmentIdFilter, setDepartmentIdFilter] = useState<
    string | undefined
  >(undefined)
  const [structureDirections, setStructureDirections] = useState<
    OrgDirection[]
  >([])
  const [structureDepartments, setStructureDepartments] = useState<
    OrgDepartment[]
  >([])

  const departmentFilterOptions = useMemo(() => {
    if (!directionIdFilter) {
      return structureDepartments
    }
    return structureDepartments.filter(
      (d) => d.directionId === directionIdFilter,
    )
  }, [structureDepartments, directionIdFilter])

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
  }, [debouncedSearch, directionIdFilter, departmentIdFilter])

  useEffect(() => {
    if (directionIdFilter == null || !departmentIdFilter) {
      return
    }
    const d = structureDepartments.find((x) => x.id === departmentIdFilter)
    if (d && d.directionId !== directionIdFilter) {
      setDepartmentIdFilter(undefined)
    }
  }, [directionIdFilter, departmentIdFilter, structureDepartments])

  useEffect(() => {
    void Promise.all([orgApi.listDirections(), orgApi.listDepartments()])
      .then(([dirs, depts]) => {
        setStructureDirections(dirs)
        setStructureDepartments(depts)
      })
      .catch(() => {
        /* silencieux : filtres optionnels */
      })
  }, [])

  const loadEmployees = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await employeesApi.getEmployees({
        page,
        limit,
        search: debouncedSearch || undefined,
        directionId: directionIdFilter,
        departmentId: departmentIdFilter,
      })
      setDataSource(res.data)
      setTotal(res.meta.total)
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les collaborateurs'),
      )
    } finally {
      setListLoading(false)
    }
  }, [page, limit, debouncedSearch, directionIdFilter, departmentIdFilter, message])

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
    modal.confirm({
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

  const handleRegenerateInvitation = useCallback(
    (row: EmployeeUser) => {
      modal.confirm({
        title: 'Générer un nouveau code d’activation ?',
        content:
          'Les codes déjà communiqués au collaborateur cesseront de fonctionner. Réservé aux comptes encore inactifs (pas d’activation sur l’app).',
        okText: 'Générer',
        cancelText: 'Annuler',
        onOk: async () => {
          try {
            const invite = await employeesApi.regenerateEmployeeInvitation(
              row.id,
            )
            await loadEmployees()
            message.success(`Nouveau code d’activation pour ${row.email}`)
            modal.info({
              title: 'Code d’activation',
              width: 520,
              okText: 'Fermer',
              content: (
                <ActivationCodeModalContent
                  email={row.email}
                  activationCode={invite.activationCode}
                  variant="regenerate"
                />
              ),
            })
          } catch (e) {
            message.error(
              getApiErrorMessage(e, 'Impossible de régénérer le code'),
            )
            throw e
          }
        },
      })
    },
    [loadEmployees, message, modal],
  )

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
          placeholder="Toutes les directions"
          style={{ minWidth: 220 }}
          value={directionIdFilter}
          onChange={(v) => setDirectionIdFilter(v)}
          options={structureDirections.map((d) => ({
            label: d.name,
            value: d.id,
          }))}
        />
        <Select
          allowClear
          placeholder="Tous les départements"
          style={{ minWidth: 260 }}
          value={departmentIdFilter}
          onChange={(v) => setDepartmentIdFilter(v)}
          options={departmentFilterOptions.map((d) => ({
            label: d.name,
            value: d.id,
          }))}
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
        onRegenerateInvitation={(row) => handleRegenerateInvitation(row)}
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
            message.success(`Compte créé pour ${result.email} — code ci-dessous`)
            modal.info({
              title: 'Code d’activation',
              width: 520,
              okText: 'Fermer',
              content: (
                <ActivationCodeModalContent
                  email={result.email}
                  activationCode={result.activationCode}
                  variant="create"
                />
              ),
            })
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
