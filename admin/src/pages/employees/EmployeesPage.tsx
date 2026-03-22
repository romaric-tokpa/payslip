import {
  PartitionOutlined,
  PlusOutlined,
  TableOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Checkbox,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ADMIN_BASE } from '../../constants/adminRoutes'
import { PageHeader } from '../../components/PageHeader'
import * as employeesApi from '../../services/employees.service'
import * as orgApi from '../../services/organization.service'
import type { EmployeeUser } from '../../types/employees'
import type { OrgDepartment } from '../../types/organization'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { BulkDepartureModal } from './BulkDepartureModal'
import { DepartureModal } from './DepartureModal'
import { EmployeeFormModal } from './EmployeeFormModal'
import { EmployeeKanban } from './EmployeeKanban'
import { EmployeeTable } from './EmployeeTable'
import { ReinstateModal } from './ReinstateModal'
import { ActivationStep } from './import/ActivationStep'
import './employees.css'

type EmployeesViewMode = 'table' | 'kanban'

const { Paragraph, Text } = Typography

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [departmentIdFilter, setDepartmentIdFilter] = useState<
    string | undefined
  >(undefined)
  const [structureDepartments, setStructureDepartments] = useState<
    OrgDepartment[]
  >([])

  const [dataSource, setDataSource] = useState<EmployeeUser[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)

  const [viewMode, setViewMode] = useState<EmployeesViewMode>('table')
  const [kanbanEmployees, setKanbanEmployees] = useState<EmployeeUser[]>([])
  const [kanbanTotal, setKanbanTotal] = useState(0)
  const [kanbanLoading, setKanbanLoading] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingEmployee, setEditingEmployee] = useState<EmployeeUser | null>(
    null,
  )

  const [activationFilter, setActivationFilter] = useState<
    'all' | 'active' | 'inactive' | 'pending_password'
  >('all')
  const [employmentFilter, setEmploymentFilter] = useState<
    | 'all'
    | 'active'
    | 'on_notice'
    | 'departed'
    | 'pending'
    | 'archived'
  >('all')
  const [contractTypeFilter, setContractTypeFilter] = useState<
    'all' | 'CDI' | 'CDD' | 'INTERIM' | 'STAGE'
  >('all')
  const [expiringContractsOnly, setExpiringContractsOnly] = useState(false)
  const [showContractColumn, setShowContractColumn] = useState(false)
  const [departureUser, setDepartureUser] = useState<EmployeeUser | null>(null)
  const [bulkDepartOpen, setBulkDepartOpen] = useState(false)
  const [reinstateUser, setReinstateUser] = useState<EmployeeUser | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  /** Conserve la fiche de chaque ligne cochée (y compris hors page courante). */
  const [selectedEmployeesById, setSelectedEmployeesById] = useState<
    Record<string, EmployeeUser>
  >({})
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkIds, setBulkIds] = useState<string[]>([])
  const [bulkTitle, setBulkTitle] = useState('')
  const [activateAllInactiveLoading, setActivateAllInactiveLoading] =
    useState(false)

  useEffect(() => {
    const ec = searchParams.get('expiringContracts')
    if (ec === '1' || ec === 'true') {
      setExpiringContractsOnly(true)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('expiringContracts')
          return next
        },
        { replace: true },
      )
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 400)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [
    debouncedSearch,
    departmentIdFilter,
    activationFilter,
    employmentFilter,
    contractTypeFilter,
    expiringContractsOnly,
  ])

  useEffect(() => {
    setSelectedRowKeys([])
    setSelectedEmployeesById({})
  }, [
    debouncedSearch,
    departmentIdFilter,
    activationFilter,
    employmentFilter,
    contractTypeFilter,
    expiringContractsOnly,
  ])

  useEffect(() => {
    void orgApi
      .listDepartments()
      .then((depts) => {
        setStructureDepartments(depts)
      })
      .catch(() => {
        /* filtres optionnels */
      })
  }, [])

  const loadEmployees = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await employeesApi.getEmployees({
        page,
        limit,
        search: debouncedSearch || undefined,
        departmentId: departmentIdFilter,
        activationStatus:
          activationFilter === 'all' ? undefined : activationFilter,
        employmentFilter:
          employmentFilter === 'all' ? undefined : employmentFilter,
        contractType:
          contractTypeFilter === 'all' ? undefined : contractTypeFilter,
        expiringContracts30d: expiringContractsOnly || undefined,
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
  }, [
    page,
    limit,
    debouncedSearch,
    departmentIdFilter,
    activationFilter,
    employmentFilter,
    contractTypeFilter,
    expiringContractsOnly,
    message,
  ])

  useEffect(() => {
    void loadEmployees()
  }, [loadEmployees])

  const loadKanbanData = useCallback(async () => {
    setKanbanLoading(true)
    try {
      const all: EmployeeUser[] = []
      let pageNum = 1
      const pageSize = 100
      let reportedTotal = 0
      while (true) {
        const res = await employeesApi.getEmployees({
          page: pageNum,
          limit: pageSize,
          search: debouncedSearch || undefined,
          departmentId: departmentIdFilter,
          activationStatus:
            activationFilter === 'all' ? undefined : activationFilter,
          employmentFilter:
            employmentFilter === 'all' ? undefined : employmentFilter,
          contractType:
            contractTypeFilter === 'all' ? undefined : contractTypeFilter,
          expiringContracts30d: expiringContractsOnly || undefined,
        })
        if (pageNum === 1) {
          reportedTotal = res.meta.total
        }
        all.push(...res.data)
        if (
          res.data.length < pageSize ||
          all.length >= res.meta.total ||
          pageNum >= 80
        ) {
          break
        }
        pageNum++
      }
      setKanbanEmployees(all)
      setKanbanTotal(reportedTotal)
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger le tableau Kanban'),
      )
      setKanbanEmployees([])
      setKanbanTotal(0)
    } finally {
      setKanbanLoading(false)
    }
  }, [
    debouncedSearch,
    departmentIdFilter,
    activationFilter,
    employmentFilter,
    contractTypeFilter,
    expiringContractsOnly,
    message,
  ])

  useEffect(() => {
    if (viewMode !== 'kanban') {
      return
    }
    void loadKanbanData()
  }, [viewMode, loadKanbanData])

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

  /** Tous les collaborateurs (EMPLOYEE) inactifs correspondant aux filtres recherche + département. */
  const fetchAllInactiveEmployeeIds = useCallback(async (): Promise<
    string[]
  > => {
    const all: EmployeeUser[] = []
    let pageNum = 1
    const pageSize = 100
    let reportedTotal = 0
    while (true) {
      const res = await employeesApi.getEmployees({
        page: pageNum,
        limit: pageSize,
        search: debouncedSearch || undefined,
        departmentId: departmentIdFilter,
        activationStatus: 'inactive',
      })
      if (pageNum === 1) {
        reportedTotal = res.meta.total
      }
      all.push(...res.data)
      if (
        res.data.length < pageSize ||
        all.length >= reportedTotal ||
        pageNum >= 80
      ) {
        break
      }
      pageNum += 1
    }
    return all.filter((r) => r.role === 'EMPLOYEE').map((r) => r.id)
  }, [debouncedSearch, departmentIdFilter])

  const handleActivateAllInactive = useCallback(async () => {
    setActivateAllInactiveLoading(true)
    try {
      const ids = await fetchAllInactiveEmployeeIds()
      if (ids.length === 0) {
        message.warning(
          'Aucun collaborateur inactif ne correspond à la recherche ou au département sélectionné.',
        )
        return
      }
      modal.confirm({
        title: 'Activer tous les comptes inactifs ?',
        content: (
          <div>
            <p style={{ marginBottom: 8 }}>
              <strong>{ids.length}</strong> compte(s) collaborateur inactif(s)
              seront activés avec un mot de passe temporaire. Les filtres
              actuels (recherche, département) sont pris en compte.
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
              Vous choisirez ensuite le canal (e-mail, PDF, etc.) comme pour une
              activation groupée.
            </p>
          </div>
        ),
        okText: 'Continuer',
        cancelText: 'Annuler',
        width: 480,
        onOk: () => {
          openBulkModal(ids, 'Activer tous les comptes inactifs')
        },
      })
    } catch (e) {
      message.error(
        getApiErrorMessage(
          e,
          'Impossible de charger la liste des comptes inactifs',
        ),
      )
    } finally {
      setActivateAllInactiveLoading(false)
    }
  }, [fetchAllInactiveEmployeeIds, message, modal])

  function confirmDeactivate(row: EmployeeUser) {
    modal.confirm({
      title: 'Désactiver ce collaborateur ?',
      content:
        "Le compte ne pourra plus se connecter tant qu'il n'est pas réactivé. Cette action est réversible.",
      okText: 'Désactiver',
      okType: 'danger',
      okButtonProps: {
        style: {
          backgroundColor: '#E74C3C',
          borderColor: '#E74C3C',
        },
      },
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          await employeesApi.deactivateEmployee(row.id)
          message.success('Collaborateur désactivé')
          await loadEmployees()
          if (viewMode === 'kanban') {
            void loadKanbanData()
          }
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
      if (viewMode === 'kanban') {
        void loadKanbanData()
      }
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
            if (viewMode === 'kanban') {
              void loadKanbanData()
            }
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
    [loadEmployees, loadKanbanData, message, modal, viewMode],
  )

  const departmentOptions = structureDepartments.map((d) => ({
    label: d.name,
    value: d.id,
  }))

  const selectedRows = useMemo(() => {
    return selectedRowKeys
      .map((k) => {
        const id = String(k)
        return (
          selectedEmployeesById[id] ?? dataSource.find((r) => r.id === id)
        )
      })
      .filter((r): r is EmployeeUser => r != null)
  }, [selectedRowKeys, selectedEmployeesById, dataSource])
  const activateTargets = useMemo(
    () => selectedRows.filter((r) => !r.isActive && r.role === 'EMPLOYEE'),
    [selectedRows],
  )
  const resendTargets = useMemo(
    () =>
      selectedRows.filter((r) => r.isActive && Boolean(r.mustChangePassword)),
    [selectedRows],
  )

  const bulkDepartTargets = useMemo(() => {
    return selectedRows.filter((r) => {
      if (r.role !== 'EMPLOYEE') {
        return false
      }
      const s =
        r.employmentStatus ?? (r.isActive ? 'ACTIVE' : 'PENDING')
      return s === 'ACTIVE' || s === 'ON_NOTICE' || s === 'PENDING'
    })
  }, [selectedRows])

  const handleArchiveDeparted = useCallback(
    (row: EmployeeUser) => {
      modal.confirm({
        title: 'Archiver ce collaborateur ?',
        content:
          'Le compte sera marqué archivé et ne pourra plus être réintégré. Les bulletins restent conservés.',
        okText: 'Archiver',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await employeesApi.archiveDepartedUser(row.id)
            message.success('Collaborateur archivé')
            await loadEmployees()
            if (viewMode === 'kanban') {
              void loadKanbanData()
            }
          } catch (e) {
            message.error(getApiErrorMessage(e, 'Archivage impossible'))
            throw e
          }
        },
      })
    },
    [loadEmployees, loadKanbanData, message, modal, viewMode],
  )

  const rowSelection = useMemo(
    () => ({
      selectedRowKeys,
      preserveSelectedRowKeys: true,
      onChange: (
        keys: React.Key[],
        rows: EmployeeUser[],
      ) => {
        setSelectedRowKeys(keys)
        const keySet = new Set(keys.map(String))
        setSelectedEmployeesById((prev) => {
          const next: Record<string, EmployeeUser> = {}
          for (const id of Object.keys(prev)) {
            if (keySet.has(id)) {
              next[id] = prev[id]!
            }
          }
          for (const row of rows) {
            next[row.id] = row
          }
          return next
        })
      },
      selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT],
    }),
    [selectedRowKeys],
  )

  function openBulkModal(ids: string[], title: string) {
    if (ids.length === 0) {
      return
    }
    setBulkIds(ids)
    setBulkTitle(title)
    setBulkOpen(true)
  }

  function closeBulkModal() {
    setBulkOpen(false)
    setBulkIds([])
  }

  const handleBulkFinished = useCallback(() => {
    closeBulkModal()
    setSelectedRowKeys([])
    setSelectedEmployeesById({})
    void loadEmployees()
    if (viewMode === 'kanban') {
      void loadKanbanData()
    }
  }, [loadEmployees, loadKanbanData, viewMode])

  return (
    <div className="employees-page">
      <PageHeader
        actions={
          <Space wrap size={8}>
            <Button
              variant="outlined"
              color="default"
              icon={<UploadOutlined />}
              onClick={() => navigate(`${ADMIN_BASE}/employees/import`)}
            >
              Importer
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
              className="employees-btn-primary-teal"
            >
              Ajouter
            </Button>
          </Space>
        }
      />

      <p className="employees-page-lead">
        Recherche, filtres et actions groupées — basculez entre la liste détaillée
        et la vue par département.
      </p>

      <section className="employees-toolbar" aria-label="Filtres et recherche">
        <div className="employees-toolbar__search-row">
          <Input.Search
            allowClear
            className="employees-search"
            placeholder="Rechercher par nom, prénom ou matricule..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Tag className="employees-total-tag">
            {viewMode === 'kanban' ? kanbanTotal : total} collaborateurs
          </Tag>
        </div>
        <div className="employees-toolbar__selects">
          <Select
            allowClear
            className="employees-filter-select"
            placeholder="Département"
            value={departmentIdFilter}
            onChange={(v) => setDepartmentIdFilter(v)}
            options={departmentOptions}
            popupMatchSelectWidth={false}
          />
          <Select
            className="employees-filter-select"
            value={activationFilter}
            onChange={(v) => setActivationFilter(v)}
            options={[
              { value: 'all', label: 'Statut : tous' },
              { value: 'active', label: 'Statut : actifs' },
              { value: 'inactive', label: 'Statut : inactifs' },
              {
                value: 'pending_password',
                label: 'Statut : MDP à changer',
              },
            ]}
            popupMatchSelectWidth={false}
          />
          <Select
            className="employees-filter-select"
            value={employmentFilter}
            onChange={(v) => setEmploymentFilter(v)}
            options={[
              { value: 'all', label: 'Cycle de vie : tous' },
              { value: 'active', label: 'Cycle : actifs / préavis' },
              { value: 'on_notice', label: 'Cycle : en préavis' },
              { value: 'departed', label: 'Cycle : sortis' },
              { value: 'pending', label: 'Cycle : en attente' },
              { value: 'archived', label: 'Cycle : archivés' },
            ]}
            popupMatchSelectWidth={false}
          />
          <Select
            className="employees-filter-select"
            value={contractTypeFilter}
            onChange={(v) => setContractTypeFilter(v)}
            options={[
              { value: 'all', label: 'Contrat : tous' },
              { value: 'CDI', label: 'CDI' },
              { value: 'CDD', label: 'CDD' },
              { value: 'INTERIM', label: 'Intérim' },
              { value: 'STAGE', label: 'Stage' },
            ]}
            popupMatchSelectWidth={false}
          />
        </div>
        <div className="employees-toolbar__options">
          <div className="employees-toolbar__checkboxes">
            <Checkbox
              checked={expiringContractsOnly}
              onChange={(e) => setExpiringContractsOnly(e.target.checked)}
            >
              Contrats à échéance (30 j.)
            </Checkbox>
            <Checkbox
              checked={showContractColumn}
              onChange={(e) => setShowContractColumn(e.target.checked)}
            >
              Colonne contrat
            </Checkbox>
          </div>
          <div className="employees-toolbar__actions">
            <Typography.Link
              className="employees-template-link"
              onClick={() => void handleDownloadTemplate()}
            >
              Modèle d’import
            </Typography.Link>
            <Button
              type="default"
              size="small"
              icon={<ThunderboltOutlined />}
              loading={activateAllInactiveLoading}
              onClick={() => void handleActivateAllInactive()}
              className="employees-activate-all-inactive-btn"
            >
              Activer tous les inactifs
            </Button>
          </div>
        </div>
      </section>

      {viewMode === 'table' && selectedRowKeys.length > 0 ? (
        <div className="employees-bulk-bar">
          <Text type="secondary" className="employees-bulk-bar__label">
            {selectedRowKeys.length} sélectionné(s)
          </Text>
          <Button
            type="primary"
            className="employees-bulk-btn-orange"
            disabled={activateTargets.length === 0}
            onClick={() =>
              openBulkModal(
                activateTargets.map((r) => r.id),
                'Activer et inviter',
              )
            }
          >
            Activer et inviter ({activateTargets.length})
          </Button>
          <Button
            variant="outlined"
            disabled={resendTargets.length === 0}
            onClick={() =>
              openBulkModal(
                resendTargets.map((r) => r.id),
                'Renvoyer les invitations',
              )
            }
          >
            Renvoyer les invitations ({resendTargets.length})
          </Button>
          <Button
            type="primary"
            danger
            icon={<UserDeleteOutlined />}
            disabled={bulkDepartTargets.length === 0}
            onClick={() => setBulkDepartOpen(true)}
          >
            Enregistrer un départ ({bulkDepartTargets.length})
          </Button>
          <Button
            type="link"
            onClick={() => {
              setSelectedRowKeys([])
              setSelectedEmployeesById({})
            }}
          >
            Effacer la sélection
          </Button>
        </div>
      ) : null}

      <div className="employees-view-panel">
        <span className="employees-view-panel__label">Affichage</span>
        <Segmented<EmployeesViewMode>
          value={viewMode}
          onChange={setViewMode}
          options={[
            {
              label: (
                <span className="employees-segment-label">
                  <TableOutlined />
                  Liste
                </span>
              ),
              value: 'table',
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

      {viewMode === 'table' ? (
        <EmployeeTable
          dataSource={dataSource}
          loading={listLoading}
          showContractColumn={showContractColumn}
          rowSelection={rowSelection}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
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
          onActivateAndInvite={(row) =>
            openBulkModal([row.id], 'Activer et inviter')
          }
          onResendInvitation={(row) =>
            openBulkModal([row.id], 'Renvoyer l’invitation')
          }
          onDepart={(row) => setDepartureUser(row)}
          onReinstate={(row) => setReinstateUser(row)}
          onArchive={(row) => handleArchiveDeparted(row)}
        />
      ) : (
        <EmployeeKanban
          employees={kanbanEmployees}
          loading={kanbanLoading}
          onEdit={openEditModal}
          onDeactivate={confirmDeactivate}
          onReactivate={(row) => void handleReactivate(row)}
          onViewPayslips={(userId) => {
            navigate(`/payslips?userId=${encodeURIComponent(userId)}`)
          }}
          onRegenerateInvitation={(row) => handleRegenerateInvitation(row)}
        />
      )}

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
          if (viewMode === 'kanban') {
            void loadKanbanData()
          }
          if (result.kind === 'create') {
            message.success(`Invitation envoyée à ${result.email}`)
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

      <Modal
        title={bulkTitle}
        open={bulkOpen}
        onCancel={closeBulkModal}
        footer={null}
        width={960}
        destroyOnHidden
      >
        <ActivationStep
          variant="plain"
          userIds={bulkIds}
          onFinished={handleBulkFinished}
        />
      </Modal>

      {departureUser ? (
        <DepartureModal
          user={departureUser}
          visible={Boolean(departureUser)}
          onClose={() => setDepartureUser(null)}
          onSuccess={() => {
            void loadEmployees()
            if (viewMode === 'kanban') {
              void loadKanbanData()
            }
          }}
        />
      ) : null}

      <BulkDepartureModal
        open={bulkDepartOpen}
        employees={bulkDepartTargets}
        onClose={() => setBulkDepartOpen(false)}
        onSuccess={() => {
          setBulkDepartOpen(false)
          setSelectedRowKeys([])
          setSelectedEmployeesById({})
          void loadEmployees()
          if (viewMode === 'kanban') {
            void loadKanbanData()
          }
        }}
      />

      {reinstateUser ? (
        <ReinstateModal
          user={reinstateUser}
          open={Boolean(reinstateUser)}
          onClose={() => setReinstateUser(null)}
          onSuccess={() => {
            void loadEmployees()
            if (viewMode === 'kanban') {
              void loadKanbanData()
            }
          }}
        />
      ) : null}
    </div>
  )
}
