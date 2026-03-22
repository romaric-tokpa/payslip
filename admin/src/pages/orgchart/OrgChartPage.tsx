import {
  BranchesOutlined,
  PlusOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import {
  Alert,
  App,
  Button,
  Dropdown,
  Input,
  Modal,
  Segmented,
  Spin,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { useAuth } from '../../contexts/AuthContext'
import * as orgApi from '../../services/org.service'
import { adminTheme } from '../../theme/adminTheme'
import type {
  OrgSelection,
  OrgTreeDepartment,
  OrgTreeDirection,
  OrgTreeResponse,
} from '../../types/orgTree'
import { ORG_TREE_UNASSIGNED_DIRECTION_ID } from '../../types/orgTree'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { OrgDetailPanel } from './OrgDetailPanel'
import type { OrgFormEntity } from './OrgFormModal'
import { OrgFormModal } from './OrgFormModal'
import type { OrgListRow } from './OrgList'
import { OrgList } from './OrgList'
import { OrgTree } from './OrgTree'
import '../employees/employees.css'
import './org-chart.css'

type ViewMode = 'tree' | 'list'

function filterOrgTree(data: OrgTreeResponse, q: string): OrgTreeResponse {
  const s = q.trim().toLowerCase()
  if (!s) return data
  const hit = (n: string) => n.toLowerCase().includes(s)

  const directions: OrgTreeDirection[] = []
  for (const dir of data.directions) {
    const departments: OrgTreeDepartment[] = []
    for (const dep of dir.departments) {
      const services = dep.services.filter((x) => hit(x.name))
      if (hit(dep.name)) {
        departments.push(dep)
      } else if (services.length > 0) {
        departments.push({ ...dep, services })
      }
    }
    if (hit(dir.name)) {
      directions.push({ ...dir, departments: dir.departments })
    } else if (departments.length > 0) {
      directions.push({ ...dir, departments })
    }
  }
  return { ...data, directions }
}

function deleteImpact(
  tree: OrgTreeResponse,
  entity: 'direction' | 'department' | 'service',
  id: string,
): { departmentCount: number; serviceCount: number } {
  if (entity === 'service') {
    return { departmentCount: 0, serviceCount: 0 }
  }
  if (entity === 'department') {
    for (const dir of tree.directions) {
      const dep = dir.departments.find((d) => d.id === id)
      if (dep) {
        return {
          departmentCount: 0,
          serviceCount: dep.services.length,
        }
      }
    }
    return { departmentCount: 0, serviceCount: 0 }
  }
  const dir = tree.directions.find((d) => d.id === id)
  if (!dir) {
    return { departmentCount: 0, serviceCount: 0 }
  }
  const departmentCount = dir.departments.length
  const serviceCount = dir.departments.reduce(
    (a, d) => a + d.services.length,
    0,
  )
  return { departmentCount, serviceCount }
}

type FormModalState =
  | { open: false }
  | {
      open: true
      entity: OrgFormEntity
      mode: 'create' | 'edit'
      recordId?: string
      initialName?: string
      defaultDirectionId?: string | null
      defaultDepartmentId?: string | null
    }

type DeleteModalState =
  | { open: false }
  | {
      open: true
      entity: 'direction' | 'department' | 'service'
      id: string
      name: string
      departmentCount: number
      serviceCount: number
    }

export function OrgChartPage() {
  const { message } = App.useApp()
  const { user } = useAuth()
  const isRh = user?.role === 'RH_ADMIN' && user.companyId != null

  const [rawTree, setRawTree] = useState<OrgTreeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('tree')
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState<OrgSelection | null>(null)
  const [formModal, setFormModal] = useState<FormModalState>({ open: false })
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    open: false,
  })

  const loadTree = useCallback(async () => {
    if (!isRh) {
      setRawTree(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await orgApi.getOrgTree()
      setRawTree(data)
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Chargement impossible'))
      setRawTree(null)
    } finally {
      setLoading(false)
    }
  }, [isRh, message])

  useEffect(() => {
    void loadTree()
  }, [loadTree])

  const displayTree = useMemo(() => {
    if (!rawTree) return null
    return filterOrgTree(rawTree, search)
  }, [rawTree, search])

  const directionOptions = useMemo(() => {
    if (!rawTree) return []
    return rawTree.directions
      .filter((d) => d.id !== ORG_TREE_UNASSIGNED_DIRECTION_ID)
      .map((d) => ({ value: d.id, label: d.name }))
  }, [rawTree])

  const departmentOptions = useMemo(() => {
    if (!rawTree) return []
    return rawTree.directions.flatMap((dir) =>
      dir.departments.map((dep) => ({
        value: dep.id,
        label: `${dir.name} — ${dep.name}`,
      })),
    )
  }, [rawTree])

  function openCreate(entity: OrgFormEntity) {
    setFormModal({
      open: true,
      entity,
      mode: 'create',
      defaultDirectionId: undefined,
      defaultDepartmentId: undefined,
    })
  }

  function openCreateDepartmentFromContext() {
    if (!selection) {
      openCreate('department')
      return
    }
    if (selection.type === 'direction' && !selection.isVirtual) {
      setFormModal({
        open: true,
        entity: 'department',
        mode: 'create',
        defaultDirectionId: selection.id,
      })
      return
    }
    if (selection.type === 'direction' && selection.isVirtual) {
      setFormModal({
        open: true,
        entity: 'department',
        mode: 'create',
        defaultDirectionId: null,
      })
      return
    }
    openCreate('department')
  }

  function openCreateServiceFromContext() {
    if (!selection) {
      openCreate('service')
      return
    }
    if (selection.type === 'department') {
      setFormModal({
        open: true,
        entity: 'service',
        mode: 'create',
        defaultDepartmentId: selection.id,
      })
      return
    }
    openCreate('service')
  }

  function openEdit(sel: OrgSelection) {
    if (sel.type === 'company') return
    if (sel.type === 'direction' && sel.isVirtual) return
    if (sel.type === 'direction') {
      setFormModal({
        open: true,
        entity: 'direction',
        mode: 'edit',
        recordId: sel.id,
        initialName: sel.name,
      })
      return
    }
    if (sel.type === 'department') {
      setFormModal({
        open: true,
        entity: 'department',
        mode: 'edit',
        recordId: sel.id,
        initialName: sel.name,
        defaultDirectionId: sel.directionId,
      })
      return
    }
    if (sel.type === 'service') {
      setFormModal({
        open: true,
        entity: 'service',
        mode: 'edit',
        recordId: sel.id,
        initialName: sel.name,
        defaultDepartmentId: sel.departmentId,
      })
    }
  }

  function openDelete(sel: OrgSelection) {
    if (!rawTree) return
    if (sel.type === 'company') return
    if (sel.type === 'direction' && sel.isVirtual) return
    if (sel.type === 'direction') {
      const { departmentCount, serviceCount } = deleteImpact(
        rawTree,
        'direction',
        sel.id,
      )
      setDeleteModal({
        open: true,
        entity: 'direction',
        id: sel.id,
        name: sel.name,
        departmentCount,
        serviceCount,
      })
      return
    }
    if (sel.type === 'department') {
      const { serviceCount } = deleteImpact(rawTree, 'department', sel.id)
      setDeleteModal({
        open: true,
        entity: 'department',
        id: sel.id,
        name: sel.name,
        departmentCount: 0,
        serviceCount,
      })
      return
    }
    setDeleteModal({
      open: true,
      entity: 'service',
      id: sel.id,
      name: sel.name,
      departmentCount: 0,
      serviceCount: 0,
    })
  }

  async function confirmDelete() {
    if (!deleteModal.open) return
    try {
      if (deleteModal.entity === 'direction') {
        await orgApi.deleteDirection(deleteModal.id)
      } else if (deleteModal.entity === 'department') {
        await orgApi.deleteDepartment(deleteModal.id)
      } else {
        await orgApi.deleteService(deleteModal.id)
      }
      message.success('Supprimé')
      setDeleteModal({ open: false })
      setSelection(null)
      await loadTree()
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Suppression impossible'))
    }
  }

  function handleListEdit(row: OrgListRow) {
    if (!rawTree) return
    if (row.type === 'direction') {
      const dir = rawTree.directions.find((d) => d.id === row.id)
      if (!dir || row.isVirtualDirection) return
      openEdit({
        type: 'direction',
        id: dir.id,
        name: dir.name,
        employeeCount: dir.employeeCount,
        departments: dir.departments,
        isVirtual: false,
      })
      return
    }
    if (row.type === 'department') {
      const parent = rawTree.directions.find((d) =>
        d.departments.some((x) => x.id === row.id),
      )
      const dep = parent?.departments.find((d) => d.id === row.id)
      if (!dep || !parent) return
      openEdit({
        type: 'department',
        id: dep.id,
        name: dep.name,
        employeeCount: dep.employeeCount,
        directionId: dep.directionId,
        directionName: parent.name,
        services: dep.services,
      })
      return
    }
    for (const dir of rawTree.directions) {
      for (const dep of dir.departments) {
        const svc = dep.services.find((s) => s.id === row.id)
        if (svc) {
          openEdit({
            type: 'service',
            id: svc.id,
            name: svc.name,
            employeeCount: svc.employeeCount,
            departmentId: svc.departmentId,
            departmentName: dep.name,
          })
          return
        }
      }
    }
  }

  function handleListDelete(row: OrgListRow) {
    if (!rawTree) return
    if (row.type === 'direction') {
      const { departmentCount, serviceCount } = deleteImpact(
        rawTree,
        'direction',
        row.id,
      )
      setDeleteModal({
        open: true,
        entity: 'direction',
        id: row.id,
        name: row.name,
        departmentCount,
        serviceCount,
      })
      return
    }
    if (row.type === 'department') {
      const { serviceCount } = deleteImpact(rawTree, 'department', row.id)
      setDeleteModal({
        open: true,
        entity: 'department',
        id: row.id,
        name: row.name,
        departmentCount: 0,
        serviceCount,
      })
      return
    }
    setDeleteModal({
      open: true,
      entity: 'service',
      id: row.id,
      name: row.name,
      departmentCount: 0,
      serviceCount: 0,
    })
  }

  const addMenu: MenuProps['items'] = [
    {
      key: 'dir',
      label: 'Ajouter une direction',
      onClick: () => openCreate('direction'),
    },
    {
      key: 'dept',
      label: 'Ajouter un département',
      onClick: () => openCreateDepartmentFromContext(),
    },
    {
      key: 'svc',
      label: 'Ajouter un service',
      onClick: () => openCreateServiceFromContext(),
    },
  ]

  if (!isRh) {
    return (
      <div className="orgchart-page">
        <Alert
          type="info"
          showIcon
          className="orgchart-access-alert"
          title="Accès réservé"
          description="Seuls les administrateurs RH peuvent consulter et modifier l’organigramme."
        />
      </div>
    )
  }

  const companyName = rawTree?.company.name ?? 'votre entreprise'

  return (
    <div className="orgchart-page">
      <PageHeader
        subtitle={`Structure organisationnelle de ${companyName}`}
        actions={
          <Dropdown menu={{ items: addMenu }} trigger={['click']}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="employees-btn-primary-teal"
            >
              Ajouter
            </Button>
          </Dropdown>
        }
      />

      <p className="orgchart-page-lead">
        Parcourez la hiérarchie directions, départements et services, ou basculez en
        liste pour trier et modifier. Cliquez sur un bloc pour le détail à droite.
      </p>

      <section className="orgchart-toolbar" aria-label="Recherche et affichage">
        <Input.Search
          allowClear
          className="orgchart-search"
          placeholder="Filtrer par nom (direction, département, service)…"
          size="large"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="employees-view-panel orgchart-view-panel">
          <span className="employees-view-panel__label">Affichage</span>
          <Segmented<ViewMode>
            value={view}
            onChange={(v) => setView(v)}
            options={[
              {
                label: (
                  <span className="employees-segment-label">
                    <BranchesOutlined />
                    Arbre
                  </span>
                ),
                value: 'tree',
              },
              {
                label: (
                  <span className="employees-segment-label">
                    <UnorderedListOutlined />
                    Liste
                  </span>
                ),
                value: 'list',
              },
            ]}
            className="employees-view-toggle orgchart-segmented"
          />
        </div>
      </section>

      <div className="orgchart-legend orgchart-legend--bar" role="note">
        <div className="orgchart-legend-item">
          <span
            className="orgchart-legend-sq"
            style={{ background: adminTheme.teal }}
          />
          Direction
        </div>
        <div className="orgchart-legend-item">
          <span
            className="orgchart-legend-sq"
            style={{ background: adminTheme.blue }}
          />
          Département
        </div>
        <div className="orgchart-legend-item">
          <span
            className="orgchart-legend-sq"
            style={{ background: adminTheme.orange }}
          />
          Service
        </div>
        <div className="orgchart-legend-item orgchart-legend-item--hint">
          <UserOutlined className="orgchart-legend-user-icon" />
          <span>Nombre de collaborateurs</span>
        </div>
      </div>

      <div
        className="orgchart-page-main"
        onClick={() => setSelection(null)}
        role="presentation"
      >
        <div
          className="orgchart-tree-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="orgchart-tree-card">
            {loading || !displayTree ? (
              <div className="orgchart-loading">
                <Spin size="large" />
                <span className="orgchart-loading__text">Chargement de l’organigramme…</span>
              </div>
            ) : view === 'tree' ? (
              <OrgTree
                data={displayTree}
                selection={selection}
                onSelect={setSelection}
                onEdit={openEdit}
              />
            ) : (
              <OrgList
                data={displayTree}
                onEditRow={handleListEdit}
                onDeleteRow={handleListDelete}
              />
            )}
          </div>
        </div>
        {selection != null && rawTree != null ? (
          <div onClick={(e) => e.stopPropagation()}>
            <OrgDetailPanel
              tree={rawTree}
              selection={selection}
              onClose={() => setSelection(null)}
              onEdit={() => openEdit(selection)}
              onDelete={() => openDelete(selection)}
              onAddDepartment={() => openCreateDepartmentFromContext()}
              onAddService={() => openCreateServiceFromContext()}
              onSelectChild={setSelection}
            />
          </div>
        ) : null}
      </div>

      {formModal.open ? (
        <OrgFormModal
          open={formModal.open}
          entity={formModal.entity}
          mode={formModal.mode}
          recordId={formModal.recordId}
          initialName={formModal.initialName}
          defaultDirectionId={formModal.defaultDirectionId}
          defaultDepartmentId={formModal.defaultDepartmentId}
          directionOptions={directionOptions}
          departmentOptions={departmentOptions}
          onClose={() => setFormModal({ open: false })}
          onSuccess={() => void loadTree()}
        />
      ) : null}

      <Modal
        title="Confirmer la suppression"
        open={deleteModal.open}
        onCancel={() => setDeleteModal({ open: false })}
        onOk={() => void confirmDelete()}
        okText="Supprimer"
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        {deleteModal.open ? (
          <div>
            <p style={{ marginTop: 0 }}>
              Supprimer « {deleteModal.name} » ? Cette action est irréversible.
            </p>
            {deleteModal.serviceCount > 0 ? (
              <p style={{ color: adminTheme.gray, fontSize: 13 }}>
                Cette action supprimera aussi les {deleteModal.serviceCount}{' '}
                service
                {deleteModal.serviceCount > 1 ? 's' : ''} rattaché
                {deleteModal.serviceCount > 1 ? 's' : ''}.
              </p>
            ) : null}
            {deleteModal.entity === 'direction' && deleteModal.departmentCount > 0 ? (
              <p style={{ color: adminTheme.gray, fontSize: 13 }}>
                {deleteModal.departmentCount} département
                {deleteModal.departmentCount > 1 ? 's' : ''} {' '}
                seront détaché{deleteModal.departmentCount > 1 ? 's' : ''} de cette
                direction (les départements ne sont pas supprimés).
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
