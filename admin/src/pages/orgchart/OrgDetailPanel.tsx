import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  RightOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { adminTheme } from '../../theme/adminTheme'
import type { OrgSelection, OrgTreeResponse } from '../../types/orgTree'
import { ORG_TREE_UNASSIGNED_DIRECTION_ID } from '../../types/orgTree'
import './org-chart.css'

function countTreeStats(tree: OrgTreeResponse): {
  departments: number
  services: number
} {
  let departments = 0
  let services = 0
  for (const d of tree.directions) {
    departments += d.departments.length
    for (const dep of d.departments) {
      services += dep.services.length
    }
  }
  return { departments, services }
}

function typeLabel(t: OrgSelection['type']): string {
  switch (t) {
    case 'company':
      return 'Entreprise'
    case 'direction':
      return 'Direction'
    case 'department':
      return 'Département'
    case 'service':
      return 'Service'
    default:
      return ''
  }
}

function barColor(t: OrgSelection['type']): string {
  switch (t) {
    case 'company':
      return adminTheme.teal
    case 'direction':
      return adminTheme.teal
    case 'department':
      return adminTheme.blue
    case 'service':
      return adminTheme.orange
    default:
      return adminTheme.gray
  }
}

export interface OrgDetailPanelProps {
  tree: OrgTreeResponse | null
  selection: OrgSelection | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onAddDepartment: () => void
  onAddService: () => void
  onSelectChild: (s: OrgSelection) => void
}

export function OrgDetailPanel({
  tree,
  selection,
  onClose,
  onEdit,
  onDelete,
  onAddDepartment,
  onAddService,
  onSelectChild,
}: OrgDetailPanelProps) {
  if (!selection || !tree) {
    return null
  }

  const { departments: totalDepts, services: totalSvcs } = countTreeStats(tree)

  const isVirtualDirection =
    selection.type === 'direction' &&
    selection.id === ORG_TREE_UNASSIGNED_DIRECTION_ID

  const showEditDelete =
    selection.type !== 'company' && !isVirtualDirection

  let statCollab = 0
  let statDepts: number | null = null
  let statSvcs: number | null = null

  if (selection.type === 'company') {
    statCollab = selection.employeeCount
    statDepts = totalDepts
    statSvcs = totalSvcs
  } else if (selection.type === 'direction') {
    statCollab = selection.employeeCount
    statDepts = selection.departments.length
    statSvcs = selection.departments.reduce(
      (a, d) => a + d.services.length,
      0,
    )
  } else if (selection.type === 'department') {
    statCollab = selection.employeeCount
    statDepts = null
    statSvcs = selection.services.length
  } else {
    statCollab = selection.employeeCount
    statDepts = null
    statSvcs = null
  }

  return (
    <aside className="org-detail-panel">
      <Button
        type="text"
        className="org-detail-panel-close"
        icon={<CloseOutlined />}
        aria-label="Fermer"
        onClick={onClose}
      />

      <div className="org-detail-head">
        <div
          className="org-detail-bar"
          style={{ background: barColor(selection.type) }}
        />
        <div>
          <h2 className="org-detail-title">{selection.name}</h2>
          <p className="org-detail-type">{typeLabel(selection.type)}</p>
        </div>
      </div>

      {showEditDelete ? (
        <div className="org-detail-actions">
          <button
            type="button"
            className="org-detail-icon-btn"
            style={{ background: adminTheme.grayLighter }}
            aria-label="Modifier"
            onClick={onEdit}
          >
            <EditOutlined style={{ color: adminTheme.dark }} />
          </button>
          <button
            type="button"
            className="org-detail-icon-btn"
            style={{ background: adminTheme.redBg }}
            aria-label="Supprimer"
            onClick={onDelete}
          >
            <DeleteOutlined style={{ color: adminTheme.red }} />
          </button>
        </div>
      ) : null}

      <div className="org-detail-stats">
        <div
          className="org-detail-stat"
          style={{ background: adminTheme.tealBg }}
        >
          <div className="org-detail-stat-label">Collaborateurs</div>
          <div
            className="org-detail-stat-value"
            style={{ color: adminTheme.teal }}
          >
            {statCollab}
          </div>
        </div>
        {statDepts != null ? (
          <div
            className="org-detail-stat"
            style={{ background: adminTheme.blueBg }}
          >
            <div className="org-detail-stat-label">Départements</div>
            <div
              className="org-detail-stat-value"
              style={{ color: adminTheme.blue }}
            >
              {statDepts}
            </div>
          </div>
        ) : null}
        {statSvcs != null ? (
          <div
            className="org-detail-stat"
            style={{ background: adminTheme.orangeBg }}
          >
            <div className="org-detail-stat-label">Services</div>
            <div
              className="org-detail-stat-value"
              style={{ color: adminTheme.orange }}
            >
              {statSvcs}
            </div>
          </div>
        ) : null}
      </div>

      {selection.type === 'company' ? (
        <>
          <div className="org-detail-section-title">Directions</div>
          {tree.directions.map((dir) => (
            <button
              key={dir.id}
              type="button"
              className="org-detail-child-row"
              onClick={() =>
                onSelectChild({
                  type: 'direction',
                  id: dir.id,
                  name: dir.name,
                  employeeCount: dir.employeeCount,
                  departments: dir.departments,
                  isVirtual: dir.id === ORG_TREE_UNASSIGNED_DIRECTION_ID,
                })
              }
            >
              <div
                className="org-detail-child-bar"
                style={{ background: adminTheme.teal }}
              />
              <div className="org-detail-child-body">
                <div className="org-detail-child-name">{dir.name}</div>
                <div className="org-detail-child-meta">
                  {dir.departments.length} départements — {dir.employeeCount}{' '}
                  pers.
                </div>
              </div>
              <RightOutlined style={{ color: adminTheme.grayLight }} />
            </button>
          ))}
        </>
      ) : null}

      {selection.type === 'direction' ? (
        <>
          <div className="org-detail-section-title">Départements</div>
          {selection.departments.map((dep) => (
            <button
              key={dep.id}
              type="button"
              className="org-detail-child-row"
              onClick={() =>
                onSelectChild({
                  type: 'department',
                  id: dep.id,
                  name: dep.name,
                  employeeCount: dep.employeeCount,
                  directionId: dep.directionId,
                  directionName: selection.name,
                  services: dep.services,
                })
              }
            >
              <div
                className="org-detail-child-bar"
                style={{ background: adminTheme.blue }}
              />
              <div className="org-detail-child-body">
                <div className="org-detail-child-name">{dep.name}</div>
                <div className="org-detail-child-meta">
                  {dep.services.length} services — {dep.employeeCount} pers.
                </div>
              </div>
              <RightOutlined style={{ color: adminTheme.grayLight }} />
            </button>
          ))}
        </>
      ) : null}

      {selection.type === 'department' ? (
        <>
          <div className="org-detail-section-title">Services</div>
          {selection.services.map((svc) => (
            <button
              key={svc.id}
              type="button"
              className="org-detail-child-row"
              onClick={() =>
                onSelectChild({
                  type: 'service',
                  id: svc.id,
                  name: svc.name,
                  employeeCount: svc.employeeCount,
                  departmentId: svc.departmentId,
                  departmentName: selection.name,
                })
              }
            >
              <div
                className="org-detail-child-bar"
                style={{ background: adminTheme.orange }}
              />
              <div className="org-detail-child-body">
                <div className="org-detail-child-name">{svc.name}</div>
                <div className="org-detail-child-meta">
                  {svc.employeeCount} pers.
                </div>
              </div>
              <RightOutlined style={{ color: adminTheme.grayLight }} />
            </button>
          ))}
        </>
      ) : null}

      {selection.type === 'service' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: adminTheme.gray,
          }}
        >
          <UserOutlined />
          <span>
            {selection.employeeCount} collaborateur
            {selection.employeeCount > 1 ? 's' : ''} dans ce service
          </span>
        </div>
      ) : null}

      {selection.type === 'company' ||
      selection.type === 'direction' ||
      selection.type === 'department' ? (
        <div className="org-detail-quick">
          {selection.type === 'company' ? (
            <>
              <Button
                type="primary"
                size="small"
                block
                onClick={onAddDepartment}
                style={{
                  background: adminTheme.teal,
                  borderColor: adminTheme.teal,
                }}
              >
                Ajouter un département
              </Button>
              <Button size="small" block variant="outlined" onClick={onAddService}>
                Ajouter un service
              </Button>
            </>
          ) : null}
          {selection.type === 'direction' ? (
            <>
              <Button
                type="primary"
                size="small"
                block
                onClick={onAddDepartment}
                style={{
                  background: adminTheme.teal,
                  borderColor: adminTheme.teal,
                }}
              >
                Ajouter un département
              </Button>
              <Button
                size="small"
                block
                variant="outlined"
                onClick={onAddService}
                style={{ borderColor: adminTheme.orange, color: adminTheme.orange }}
              >
                Ajouter un service
              </Button>
            </>
          ) : null}
          {selection.type === 'department' ? (
            <Button
              size="small"
              block
              variant="outlined"
              onClick={onAddService}
              style={{ borderColor: adminTheme.orange, color: adminTheme.orange }}
            >
              Ajouter un service
            </Button>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
