import {
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  MoreOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  Space,
  Spin,
  Tag,
} from 'antd'
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
  onVerifySignature: (row: Payslip) => void
  onDownloadCertificate: (row: Payslip) => void
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
  onVerifySignature,
  onDownloadCertificate,
}: PayslipsKanbanProps) {
  function cardMenuItems(row: Payslip): MenuProps['items'] {
    const opening = openingId === row.id
    const items: MenuProps['items'] = [
      {
        key: 'open',
        label: opening ? 'Ouverture…' : 'Ouvrir le PDF',
        icon: <EyeOutlined />,
        disabled: opening,
      },
    ]
    if (row.signature?.verificationCode) {
      items.push({
        key: 'verify_sig',
        label: 'Vérifier l’accusé',
        icon: <SafetyCertificateOutlined />,
      })
    }
    if (row.signature?.id) {
      items.push({
        key: 'cert',
        label: 'Certificat PDF',
        icon: <DownloadOutlined />,
      })
    }
    items.push({
      key: 'delete',
      label: 'Supprimer',
      icon: <DeleteOutlined />,
      danger: true,
    })
    return items
  }

  function onCardMenuClick(row: Payslip): MenuProps['onClick'] {
    return ({ key, domEvent }) => {
      domEvent.stopPropagation()
      if (key === 'open') {
        void onOpenPdf(row)
      } else if (key === 'verify_sig') {
        onVerifySignature(row)
      } else if (key === 'cert') {
        onDownloadCertificate(row)
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
                        <Space size={6} wrap>
                          {row.isRead ? (
                            <Tag color="success">Lu</Tag>
                          ) : (
                            <Tag>Non lu</Tag>
                          )}
                          {row.isSigned ? (
                            <Tag color="processing">Accusé signé</Tag>
                          ) : (
                            <Tag>Non signé</Tag>
                          )}
                        </Space>
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
