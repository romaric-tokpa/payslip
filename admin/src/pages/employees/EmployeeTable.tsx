import { FileProtectOutlined, MoreOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Avatar, Button, Card, Dropdown, Space, Table, Tag, Tooltip } from 'antd'
import type {
  ColumnsType,
  TablePaginationConfig,
  TableProps,
} from 'antd/es/table'
import type { ReactNode } from 'react'
import type { EmployeeUser, EmploymentStatus } from '../../types/employees'
import './employees.css'

type EmployeeTableProps = {
  dataSource: EmployeeUser[]
  loading: boolean
  pagination: TablePaginationConfig
  onChange: TableProps<EmployeeUser>['onChange']
  rowSelection?: TableProps<EmployeeUser>['rowSelection']
  showContractColumn?: boolean
  onEdit: (row: EmployeeUser) => void
  onDeactivate: (row: EmployeeUser) => void
  onReactivate: (row: EmployeeUser) => void
  onViewPayslips: (userId: string) => void
  onRegenerateInvitation: (row: EmployeeUser) => void
  onActivateAndInvite?: (row: EmployeeUser) => void
  onResendInvitation?: (row: EmployeeUser) => void
  onDepart?: (row: EmployeeUser) => void
  onReinstate?: (row: EmployeeUser) => void
  onArchive?: (row: EmployeeUser) => void
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

function lifecycleStatus(row: EmployeeUser): EmploymentStatus {
  return (
    row.employmentStatus ??
    (row.isActive ? 'ACTIVE' : 'PENDING')
  )
}

function statusTag(row: EmployeeUser) {
  const s = lifecycleStatus(row)
  if (s === 'PENDING') {
    return (
      <Tooltip title="En attente d’activation">
        <Tag>En attente</Tag>
      </Tooltip>
    )
  }
  if (s === 'ACTIVE') {
    return (
      <Space orientation="vertical" size={4}>
        <Tag color="green">Actif</Tag>
        {row.isActive && row.mustChangePassword ? (
          <Tag color="warning" style={{ marginInlineEnd: 0 }}>
            MDP provisoire
          </Tag>
        ) : null}
      </Space>
    )
  }
  if (s === 'ON_NOTICE') {
    const end = row.noticeEndDate
      ? new Date(row.noticeEndDate).toLocaleDateString('fr-FR')
      : '—'
    return (
      <Tooltip title={`Fin du préavis le ${end}`}>
        <Tag color="orange">En préavis</Tag>
      </Tooltip>
    )
  }
  if (s === 'DEPARTED') {
    const d = row.departureDate
      ? new Date(row.departureDate).toLocaleDateString('fr-FR')
      : '—'
    const t = row.departureType ?? '—'
    return (
      <Tooltip title={`Départ le ${d} — ${t}`}>
        <Tag color="red">Sorti</Tag>
      </Tooltip>
    )
  }
  return (
    <Tooltip title="Compte archivé">
      <Tag color="default">Archivé</Tag>
    </Tooltip>
  )
}

function contractLabelFr(t: EmployeeUser['contractType']): string {
  switch (t) {
    case 'CDI':
      return 'CDI'
    case 'CDD':
      return 'CDD'
    case 'INTERIM':
      return 'Intérim'
    case 'STAGE':
      return 'Stage'
    default:
      return ''
  }
}

function contractCell(row: EmployeeUser): ReactNode {
  const t = row.contractType
  if (!t) {
    return (
      <span style={{ color: '#999', fontStyle: 'italic', fontSize: 12 }}>
        Non renseigné
      </span>
    )
  }

  const end = row.contractEndDate ? new Date(row.contractEndDate) : null
  const endValid = end != null && !Number.isNaN(end.getTime())
  const endStr = endValid ? end!.toLocaleDateString('fr-FR') : ''
  const days =
    endValid && t !== 'CDI'
      ? Math.ceil((end!.getTime() - Date.now()) / 86_400_000)
      : null
  const expired = days != null && days < 0
  const urgent = days != null && days >= 0 && days < 30

  const dateStyle: React.CSSProperties = {
    fontSize: 9,
    marginLeft: 6,
    color: expired ? '#cf1322' : urgent ? '#d46b08' : '#8c8c8c',
  }

  if (t === 'CDI') {
    return <Tag color="default">{contractLabelFr(t)}</Tag>
  }

  if (t === 'CDD') {
    return (
      <span>
        <Tag color={expired ? 'red' : urgent ? 'orange' : 'blue'}>
          {expired ? 'CDD expiré' : 'CDD'}
        </Tag>
        {endStr ? <span style={dateStyle}>{endStr}</span> : null}
      </span>
    )
  }

  if (t === 'INTERIM') {
    return (
      <span>
        <Tag color="purple">{contractLabelFr(t)}</Tag>
        {endStr ? <span style={dateStyle}>{endStr}</span> : null}
      </span>
    )
  }

  return (
    <span>
      <Tag color="cyan">{contractLabelFr(t)}</Tag>
      {endStr ? <span style={dateStyle}>{endStr}</span> : null}
    </span>
  )
}

export function EmployeeTable({
  dataSource,
  loading,
  pagination,
  onChange,
  rowSelection,
  showContractColumn = false,
  onEdit,
  onDeactivate,
  onReactivate,
  onViewPayslips,
  onRegenerateInvitation,
  onActivateAndInvite,
  onResendInvitation,
  onDepart,
  onReinstate,
  onArchive,
}: EmployeeTableProps) {
  const baseColumns: ColumnsType<EmployeeUser> = [
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
  ]

  const contractCol: ColumnsType<EmployeeUser>[0] = {
    title: 'Contrat',
    key: 'contract',
    width: 200,
    ellipsis: true,
    render: (_: unknown, row) => contractCell(row),
  }

  const statusCol: ColumnsType<EmployeeUser>[0] = {
    title: 'Statut',
    key: 'lifecycle',
    width: 148,
    render: (_: unknown, row) => statusTag(row),
  }

  const actionsCol: ColumnsType<EmployeeUser>[0] = {
    title: 'Actions',
    key: 'actions',
    width: 72,
    fixed: 'right',
    className: 'employees-table-col-actions',
    render: (_: unknown, row) => {
      const s = lifecycleStatus(row)
      const items: MenuProps['items'] = []

      if (
        (s === 'ACTIVE' || s === 'ON_NOTICE') &&
        row.isActive
      ) {
        items.push({ key: 'edit', label: 'Modifier' })
        if (onDepart) {
          items.push({
            key: 'depart',
            label: 'Enregistrer un départ',
            danger: true,
          })
        }
        items.push({
          key: 'payslips',
          label: 'Voir les bulletins',
          icon: <FileProtectOutlined />,
        })
        items.push({
          key: 'deactivate',
          label: 'Désactiver',
          danger: true,
        })
      } else if (
        (s === 'ACTIVE' || s === 'ON_NOTICE') &&
        !row.isActive
      ) {
        items.push({ key: 'edit', label: 'Modifier' })
        items.push({ key: 'reactivate', label: 'Réactiver' })
        items.push({
          key: 'payslips',
          label: 'Voir les bulletins',
          icon: <FileProtectOutlined />,
        })
      } else if (s === 'DEPARTED') {
        if (onReinstate) {
          items.push({ key: 'reinstate', label: 'Réintégrer' })
        }
        items.push({
          key: 'payslips',
          label: 'Voir les bulletins',
          icon: <FileProtectOutlined />,
        })
        items.push({ key: 'edit', label: 'Modifier' })
        if (onArchive) {
          items.push({
            key: 'archive',
            label: 'Archiver (purge compte)',
            danger: true,
          })
        }
      } else if (s === 'PENDING') {
        items.push({ key: 'edit', label: 'Modifier' })
        if (onActivateAndInvite) {
          items.push({ key: 'activate_invite', label: 'Activer et inviter' })
        }
      } else {
        items.push({ key: 'edit', label: 'Modifier' })
      }

      if (s === 'PENDING') {
        items.push({
          key: 'invitation',
          label: 'Code d’activation (nouveau)',
        })
      }
      if (row.isActive && row.mustChangePassword && onResendInvitation) {
        items.push({
          key: 'resend_invite',
          label: 'Renvoyer l’invitation',
        })
      }

      const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
        domEvent.stopPropagation()
        if (key === 'edit') onEdit(row)
        else if (key === 'depart') onDepart?.(row)
        else if (key === 'reinstate') onReinstate?.(row)
        else if (key === 'archive') onArchive?.(row)
        else if (key === 'payslips') onViewPayslips(row.id)
        else if (key === 'deactivate') onDeactivate(row)
        else if (key === 'reactivate') onReactivate(row)
        else if (key === 'activate_invite') onActivateAndInvite?.(row)
        else if (key === 'resend_invite') onResendInvitation?.(row)
        else if (key === 'invitation') onRegenerateInvitation(row)
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
  }

  const columns: ColumnsType<EmployeeUser> = showContractColumn
    ? [...baseColumns, contractCol, statusCol, actionsCol]
    : [...baseColumns, statusCol, actionsCol]

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
        rowClassName={(record) => {
          const s = lifecycleStatus(record)
          if (s === 'DEPARTED') {
            return 'employee-row-departed'
          }
          return record.isActive ? '' : 'employee-row-inactive'
        }}
        scroll={{ x: showContractColumn ? 960 : 820 }}
        tableLayout="fixed"
      />
    </Card>
  )
}
