import type {
  OrgSelection,
  OrgTreeDepartment,
  OrgTreeDirection,
  OrgTreeResponse,
  OrgTreeService,
} from '../../types/orgTree'
import { ORG_TREE_UNASSIGNED_DIRECTION_ID } from '../../types/orgTree'
import { OrgTreeNode } from './OrgTreeNode'
import './org-chart.css'

export interface OrgTreeProps {
  data: OrgTreeResponse
  selection: OrgSelection | null
  onSelect: (s: OrgSelection) => void
  onEdit: (s: OrgSelection) => void
}

function selKey(s: OrgSelection | null): string | null {
  if (!s) return null
  return `${s.type}:${s.id}`
}

export function OrgTree({ data, selection, onSelect, onEdit }: OrgTreeProps) {
  const sk = selKey(selection)

  function renderService(
    _dir: OrgTreeDirection,
    dep: OrgTreeDepartment,
    svc: OrgTreeService,
  ) {
    const s: OrgSelection = {
      type: 'service',
      id: svc.id,
      name: svc.name,
      employeeCount: svc.employeeCount,
      departmentId: svc.departmentId,
      departmentName: dep.name,
    }
    const key = `service:${svc.id}`
    return (
      <OrgTreeNode
        key={svc.id}
        variant="service"
        title={svc.name}
        count={svc.employeeCount}
        selected={sk === key}
        onSelect={() => onSelect(s)}
        showEdit
        onEdit={() => onEdit(s)}
      />
    )
  }

  function renderDepartment(dir: OrgTreeDirection, dep: OrgTreeDepartment) {
    const s: OrgSelection = {
      type: 'department',
      id: dep.id,
      name: dep.name,
      employeeCount: dep.employeeCount,
      directionId: dep.directionId,
      directionName: dir.name,
      services: dep.services,
    }
    const key = `department:${dep.id}`
    return (
      <div key={dep.id} className="orgchart-dept-column">
        <div className="orgchart-vline orgchart-vline--md" />
        <OrgTreeNode
          variant="department"
          title={dep.name}
          count={dep.employeeCount}
          selected={sk === key}
          onSelect={() => onSelect(s)}
          showEdit
          onEdit={() => onEdit(s)}
        />
        {dep.services.length > 0 ? (
          <>
            <div className="orgchart-vline orgchart-vline--md" />
            <div className="orgchart-services-row">
              {dep.services.map((svc) => renderService(dir, dep, svc))}
            </div>
          </>
        ) : null}
      </div>
    )
  }

  function renderDirection(dir: OrgTreeDirection) {
    const isVirtual = dir.id === ORG_TREE_UNASSIGNED_DIRECTION_ID
    const s: OrgSelection = {
      type: 'direction',
      id: dir.id,
      name: dir.name,
      employeeCount: dir.employeeCount,
      departments: dir.departments,
      isVirtual,
    }
    const key = `direction:${dir.id}`
    return (
      <div key={dir.id} className="orgchart-direction-column">
        <div className="orgchart-vline orgchart-vline--md" />
        <OrgTreeNode
          variant="direction"
          title={dir.name}
          count={dir.employeeCount}
          selected={sk === key}
          onSelect={() => onSelect(s)}
          showEdit={!isVirtual}
          onEdit={() => onEdit(s)}
        />
        {dir.departments.length > 0 ? (
          <>
            <div className="orgchart-vline orgchart-vline--md" />
            <div className="orgchart-depts-row">
              {dir.departments.map((dep) => renderDepartment(dir, dep))}
            </div>
          </>
        ) : null}
      </div>
    )
  }

  const companySel: OrgSelection = {
    type: 'company',
    id: data.company.id,
    name: data.company.name,
    employeeCount: data.company.totalEmployees,
  }

  return (
    <div className="orgchart-tree-inner">
      <OrgTreeNode
        variant="company"
        title={data.company.name}
        count={data.company.totalEmployees}
        selected={sk === `company:${data.company.id}`}
        onSelect={() => onSelect(companySel)}
      />
      <div className="orgchart-vline orgchart-vline--lg" />
      <div className="orgchart-directions-row">
        {data.directions.map((dir) => renderDirection(dir))}
      </div>
    </div>
  )
}
