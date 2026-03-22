import { FileProtectOutlined, MoreOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Avatar, Button, Card, Dropdown, Empty, Spin, Tag } from 'antd'
import type { EmployeeUser } from '../../types/employees'
import './employees.css'

export type EmployeeKanbanProps = {
  employees: EmployeeUser[]
  loading: boolean
  onEdit: (row: EmployeeUser) => void
  onDeactivate: (row: EmployeeUser) => void
  onReactivate: (row: EmployeeUser) => void
  onViewPayslips: (userId: string) => void
  onRegenerateInvitation: (row: EmployeeUser) => void
}

function rowInitials(row: EmployeeUser): string {
  const a = row.firstName?.trim()?.[0] ?? ''
  const b = row.lastName?.trim()?.[0] ?? ''
  const pair = `${a}${b}`.toUpperCase()
  return pair.length > 0 ? pair : '?'
}

function columnKey(row: EmployeeUser): string {
  const fromOrg = row.orgDepartment?.name?.trim()
  if (fromOrg) return fromOrg
  const free = row.department?.trim()
  if (free) return free
  return 'Sans département'
}

function sortColumnKeys(keys: string[]): string[] {
  const rest = keys.filter((k) => k !== 'Sans département')
  rest.sort((a, b) => a.localeCompare(b, 'fr'))
  if (keys.includes('Sans département')) {
    rest.push('Sans département')
  }
  return rest
}

function buildColumns(employees: EmployeeUser[]): Map<string, EmployeeUser[]> {
  const map = new Map<string, EmployeeUser[]>()
  for (const e of employees) {
    const k = columnKey(e)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(e)
  }
  for (const list of map.values()) {
    list.sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        'fr',
      ),
    )
  }
  return map
}

export function EmployeeKanban({
  employees,
  loading,
  onEdit,
  onDeactivate,
  onReactivate,
  onViewPayslips,
  onRegenerateInvitation,
}: EmployeeKanbanProps) {
  const grouped = buildColumns(employees)
  const columnKeys = sortColumnKeys([...grouped.keys()])

  function cardMenuItems(row: EmployeeUser): MenuProps['items'] {
    return [
      { key: 'edit', label: 'Modifier' },
      row.isActive
        ? { key: 'deactivate', label: 'Désactiver', danger: true }
        : { key: 'reactivate', label: 'Réactiver' },
      ...(!row.isActive && row.role === 'EMPLOYEE'
        ? [{ key: 'invitation', label: 'Code d’activation (nouveau)' } as const]
        : []),
      {
        key: 'payslips',
        label: 'Voir les bulletins',
        icon: <FileProtectOutlined />,
      },
    ]
  }

  function onCardMenuClick(row: EmployeeUser): MenuProps['onClick'] {
    return ({ key, domEvent }) => {
      domEvent.stopPropagation()
      if (key === 'edit') onEdit(row)
      else if (key === 'deactivate') onDeactivate(row)
      else if (key === 'reactivate') onReactivate(row)
      else if (key === 'invitation') onRegenerateInvitation(row)
      else if (key === 'payslips') onViewPayslips(row.id)
    }
  }

  if (loading && employees.length === 0) {
    return (
      <div className="employees-kanban-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!loading && employees.length === 0) {
    return (
      <Card className="employees-kanban-empty-card" variant="outlined">
        <Empty description="Aucun collaborateur ne correspond aux filtres." />
      </Card>
    )
  }

  return (
    <div className="employees-kanban-wrap">
      {loading ? (
        <div className="employees-kanban-overlay">
          <Spin />
        </div>
      ) : null}
      <div className="employees-kanban-board">
        {columnKeys.map((col) => {
          const list = grouped.get(col) ?? []
          return (
            <div key={col} className="employees-kanban-column">
              <div className="employees-kanban-column-head">
                <span className="employees-kanban-column-title">{col}</span>
                <Tag className="employees-kanban-column-count">{list.length}</Tag>
              </div>
              <div className="employees-kanban-column-body">
                {list.map((row) => (
                  <Card
                    key={row.id}
                    size="small"
                    className={`employees-kanban-card${row.isActive ? '' : ' employees-kanban-card--inactive'}`}
                    variant="outlined"
                  >
                    <div className="employees-kanban-card-inner">
                      <Avatar
                        size={48}
                        src={row.profilePhotoUrl || undefined}
                        className={
                          row.isActive
                            ? 'employees-kanban-avatar employees-kanban-avatar--active'
                            : 'employees-kanban-avatar employees-kanban-avatar--inactive'
                        }
                      >
                        {rowInitials(row)}
                      </Avatar>
                      <div className="employees-kanban-card-main">
                        <div className="employees-kanban-card-name">
                          {row.lastName} {row.firstName}
                        </div>
                        {row.position?.trim() ? (
                          <div className="employees-kanban-card-position">
                            {row.position}
                          </div>
                        ) : null}
                        <div className="employees-kanban-card-email">
                          {row.email}
                        </div>
                        <div className="employees-kanban-card-meta">
                          {row.isActive ? (
                            <Tag className="employee-status-tag employee-status-tag--active">
                              Actif
                            </Tag>
                          ) : (
                            <Tag className="employee-status-tag employee-status-tag--inactive">
                              Inactif
                            </Tag>
                          )}
                        </div>
                      </div>
                      <Dropdown
                        menu={{
                          items: cardMenuItems(row),
                          onClick: onCardMenuClick(row),
                        }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<MoreOutlined />}
                          aria-label="Actions"
                          className="employees-kanban-card-actions"
                        />
                      </Dropdown>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
