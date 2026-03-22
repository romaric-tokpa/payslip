import { DeleteOutlined, EyeOutlined, MoreOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Avatar, Button, Card, Dropdown, Empty, Spin, Tag } from 'antd'
import dayjs from 'dayjs'
import type { Payslip } from '../../types/payslips'

export type PayslipKanbanMonthGroup = {
  sortKey: number
  title: string
  rows: Payslip[]
}

export type PayslipsKanbanProps = {
  groups: PayslipKanbanMonthGroup[]
  loading: boolean
  openingId: string | null
  onOpenPdf: (row: Payslip) => void
  onDelete: (row: Payslip) => void
}

function payslipUserInitials(u: Payslip['user']): string {
  const a = u.firstName?.trim()?.[0] ?? ''
  const b = u.lastName?.trim()?.[0] ?? ''
  const pair = `${b}${a}`.toUpperCase()
  return pair.length > 0 ? pair : '?'
}

function formatFileSize(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

export function PayslipsKanban({
  groups,
  loading,
  openingId,
  onOpenPdf,
  onDelete,
}: PayslipsKanbanProps) {
  function cardMenuItems(row: Payslip): MenuProps['items'] {
    const opening = openingId === row.id
    return [
      {
        key: 'open',
        label: opening ? 'Ouverture…' : 'Ouvrir le PDF',
        icon: <EyeOutlined />,
        disabled: opening,
      },
      {
        key: 'delete',
        label: 'Supprimer',
        icon: <DeleteOutlined />,
        danger: true,
      },
    ]
  }

  function onCardMenuClick(row: Payslip): MenuProps['onClick'] {
    return ({ key, domEvent }) => {
      domEvent.stopPropagation()
      if (key === 'open') {
        void onOpenPdf(row)
      } else if (key === 'delete') {
        onDelete(row)
      }
    }
  }

  if (loading && groups.length === 0) {
    return (
      <div className="employees-kanban-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!loading && groups.length === 0) {
    return (
      <Card className="employees-kanban-empty-card" variant="outlined">
        <Empty description="Aucun bulletin pour ces critères." />
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
        {groups.map((col) => (
          <div key={col.sortKey} className="employees-kanban-column">
            <div className="employees-kanban-column-head">
              <span className="employees-kanban-column-title" title={col.title}>
                {col.title}
              </span>
              <Tag className="employees-kanban-column-count">
                {col.rows.length}
              </Tag>
            </div>
            <div className="employees-kanban-column-body">
              {col.rows.map((row) => (
                <Card
                  key={row.id}
                  size="small"
                  className="employees-kanban-card"
                  variant="outlined"
                >
                  <div className="employees-kanban-card-inner">
                    <Avatar
                      size={48}
                      src={row.user.profilePhotoUrl || undefined}
                      className="employees-kanban-avatar employees-kanban-avatar--active"
                      alt=""
                    >
                      {payslipUserInitials(row.user)}
                    </Avatar>
                    <div className="employees-kanban-card-main">
                      <div className="employees-kanban-card-name">
                        {row.user.lastName} {row.user.firstName}
                      </div>
                      <div className="employees-kanban-card-position">
                        {row.user.employeeId?.trim() || '—'}
                        {row.user.department?.trim()
                          ? ` · ${row.user.department.trim()}`
                          : ''}
                      </div>
                      <div className="employees-kanban-card-email">
                        {formatFileSize(row.fileSize)} · envoyé le{' '}
                        {dayjs(row.uploadedAt).format('DD/MM/YYYY HH:mm')}
                      </div>
                      <div className="employees-kanban-card-meta">
                        {row.isRead ? (
                          <Tag color="success">Lu</Tag>
                        ) : (
                          <Tag>Non lu</Tag>
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
        ))}
      </div>
    </div>
  )
}
