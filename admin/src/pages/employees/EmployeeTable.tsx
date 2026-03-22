import { FileProtectOutlined, MoreOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Avatar, Button, Card, Dropdown, Space, Table, Tag } from 'antd'
import type {
  ColumnsType,
  TablePaginationConfig,
  TableProps,
} from 'antd/es/table'
import type { EmployeeUser } from '../../types/employees'
import './employees.css'

type EmployeeTableProps = {
  dataSource: EmployeeUser[]
  loading: boolean
  pagination: TablePaginationConfig
  onChange: TableProps<EmployeeUser>['onChange']
  rowSelection?: TableProps<EmployeeUser>['rowSelection']
  onEdit: (row: EmployeeUser) => void
  onDeactivate: (row: EmployeeUser) => void
  onReactivate: (row: EmployeeUser) => void
  onViewPayslips: (userId: string) => void
  onRegenerateInvitation: (row: EmployeeUser) => void
  onActivateAndInvite?: (row: EmployeeUser) => void
  onResendInvitation?: (row: EmployeeUser) => void
}

function rowInitials(row: EmployeeUser): string {
  const a = row.firstName?.trim()?.[0] ?? ''
  const b = row.lastName?.trim()?.[0] ?? ''
  const pair = `${a}${b}`.toUpperCase()
  return pair.length > 0 ? pair : '?'
}

function departmentLabel(row: EmployeeUser): string {
  return row.orgDepartment?.name ?? row.department ?? '—'
}

export function EmployeeTable({
  dataSource,
  loading,
  pagination,
  onChange,
  rowSelection,
  onEdit,
  onDeactivate,
  onReactivate,
  onViewPayslips,
  onRegenerateInvitation,
  onActivateAndInvite,
  onResendInvitation,
}: EmployeeTableProps) {
  const columns: ColumnsType<EmployeeUser> = [
    {
      title: ' ',
      key: 'avatar',
      width: 92,
      className: 'employees-table-col-avatar',
      render: (_: unknown, row) => (
        <Avatar
          size={56}
          src={row.profilePhotoUrl || undefined}
          alt=""
          className={
            row.isActive
              ? 'employee-table-avatar employee-table-avatar--active'
              : 'employee-table-avatar employee-table-avatar--inactive'
          }
        >
          {rowInitials(row)}
        </Avatar>
      ),
    },
    {
      title: 'Nom',
      key: 'name',
      ellipsis: true,
      render: (_: unknown, row) => (
        <div className="employee-table-name-cell">
          <div className="employee-table-name">
            {row.lastName} {row.firstName}
          </div>
          <div className="employee-table-matricule">
            {row.employeeId ?? '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      className: 'employees-table-col-email',
      render: (email: string) => (
        <span className="employee-table-email">{email}</span>
      ),
    },
    {
      title: 'Département',
      key: 'department',
      ellipsis: true,
      render: (_: unknown, row) => (
        <span className="employee-table-dept">{departmentLabel(row)}</span>
      ),
    },
    {
      title: 'Statut',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 138,
      render: (_active: boolean, row) => (
        <Space orientation="vertical" size={4}>
          {row.isActive ? (
            <Tag className="employee-status-tag employee-status-tag--active">
              Actif
            </Tag>
          ) : (
            <Tag className="employee-status-tag employee-status-tag--inactive">
              Inactif
            </Tag>
          )}
          {row.isActive && row.mustChangePassword ? (
            <Tag color="warning" style={{ marginInlineEnd: 0 }}>
              MDP provisoire
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 72,
      fixed: 'right',
      className: 'employees-table-col-actions',
      render: (_: unknown, row) => {
        const items: MenuProps['items'] = [{ key: 'edit', label: 'Modifier' }]
        if (!row.isActive && row.role === 'EMPLOYEE' && onActivateAndInvite) {
          items.push({
            key: 'activate_invite',
            label: 'Activer et inviter',
          })
        }
        if (row.isActive && row.mustChangePassword && onResendInvitation) {
          items.push({
            key: 'resend_invite',
            label: 'Renvoyer l’invitation',
          })
        }
        items.push(
          row.isActive
            ? { key: 'deactivate', label: 'Désactiver', danger: true }
            : { key: 'reactivate', label: 'Réactiver' },
        )
        if (!row.isActive && row.role === 'EMPLOYEE') {
          items.push({
            key: 'invitation',
            label: 'Code d’activation (nouveau)',
          })
        }
        items.push({
          key: 'payslips',
          label: 'Voir les bulletins',
          icon: <FileProtectOutlined />,
        })

        const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
          domEvent.stopPropagation()
          if (key === 'edit') onEdit(row)
          else if (key === 'activate_invite') onActivateAndInvite?.(row)
          else if (key === 'resend_invite') onResendInvitation?.(row)
          else if (key === 'deactivate') onDeactivate(row)
          else if (key === 'reactivate') onReactivate(row)
          else if (key === 'invitation') onRegenerateInvitation(row)
          else if (key === 'payslips') onViewPayslips(row.id)
        }

        return (
          <Dropdown
            menu={{ items, onClick: onMenuClick }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              aria-label="Actions"
              className="employee-actions-trigger"
            />
          </Dropdown>
        )
      },
    },
  ]

  const paginationConfig: TablePaginationConfig = {
    ...pagination,
    size: 'small',
  }

  return (
    <Card
      className="employees-table-card"
      variant="outlined"
      styles={{ body: { padding: 0 } }}
    >
      <Table<EmployeeUser>
        className="employees-table"
        rowKey="id"
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        pagination={paginationConfig}
        onChange={onChange}
        rowSelection={rowSelection}
        rowClassName={(record) =>
          record.isActive ? '' : 'employee-row-inactive'
        }
        scroll={{ x: 820 }}
        tableLayout="fixed"
      />
    </Card>
  )
}
