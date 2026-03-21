import { FileProtectOutlined, MoreOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Button, Dropdown, Table, Tag, Typography } from 'antd'
import type {
  ColumnsType,
  TablePaginationConfig,
  TableProps,
} from 'antd/es/table'
import type { EmployeeUser } from '../../types/employees'
import './employees.css'

const { Text } = Typography

type EmployeeTableProps = {
  dataSource: EmployeeUser[]
  loading: boolean
  pagination: TablePaginationConfig
  onChange: TableProps<EmployeeUser>['onChange']
  onEdit: (row: EmployeeUser) => void
  onDeactivate: (row: EmployeeUser) => void
  onReactivate: (row: EmployeeUser) => void
  onViewPayslips: (userId: string) => void
  onRegenerateInvitation: (row: EmployeeUser) => void
}

export function EmployeeTable({
  dataSource,
  loading,
  pagination,
  onChange,
  onEdit,
  onDeactivate,
  onReactivate,
  onViewPayslips,
  onRegenerateInvitation,
}: EmployeeTableProps) {
  const columns: ColumnsType<EmployeeUser> = [
    {
      title: 'Matricule',
      dataIndex: 'employeeId',
      key: 'employeeId',
      render: (value: string | null) =>
        value ? <Text strong>{value}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Nom complet',
      key: 'fullName',
      sorter: false,
      render: (_: unknown, row) =>
        `${row.firstName} ${row.lastName}`.trim() || '—',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: 'Direction',
      key: 'direction',
      width: 140,
      ellipsis: true,
      render: (_: unknown, row) =>
        row.orgDepartment?.direction?.name ?? '—',
    },
    {
      title: 'Département',
      key: 'department',
      render: (_: unknown, row) =>
        row.orgDepartment?.name ?? row.department ?? '—',
    },
    {
      title: 'Service',
      key: 'service',
      render: (_: unknown, row) => row.orgService?.name ?? '—',
    },
    {
      title: 'Poste',
      dataIndex: 'position',
      key: 'position',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Statut',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 110,
      render: (active: boolean) =>
        active ? (
          <Tag color="success">Actif</Tag>
        ) : (
          <Tag color="error">Inactif</Tag>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 88,
      fixed: 'right',
      render: (_: unknown, row) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: 'Modifier' },
          row.isActive
            ? { key: 'deactivate', label: 'Désactiver', danger: true }
            : { key: 'reactivate', label: 'Réactiver' },
          ...(!row.isActive && row.role === 'EMPLOYEE'
            ? [
                {
                  key: 'invitation',
                  label: 'Code d’activation (nouveau)',
                } as const,
              ]
            : []),
          { key: 'payslips', label: 'Voir les bulletins', icon: <FileProtectOutlined /> },
        ]

        const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
          domEvent.stopPropagation()
          if (key === 'edit') onEdit(row)
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
            <Button type="text" icon={<MoreOutlined />} aria-label="Actions" />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <Table<EmployeeUser>
      rowKey="id"
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      pagination={pagination}
      onChange={onChange}
      rowClassName={(record) =>
        record.isActive ? '' : 'employee-row-inactive'
      }
      scroll={{ x: 1220 }}
    />
  )
}
