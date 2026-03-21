import { CloseOutlined } from '@ant-design/icons'
import { Button, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { BulkPreviewRow } from './bulkPreviewTypes'
import { MONTHS_FR } from './payslipUploadConstants'

const { Text } = Typography

type BulkPreviewTableProps = {
  rows: BulkPreviewRow[]
  resolving: boolean
  onRemove: (key: string) => void
}

function statusTag(row: BulkPreviewRow) {
  if (row.status === 'invalid_format') {
    return <Tag color="orange">Format invalide</Tag>
  }
  if (row.status === 'oversized') {
    return <Tag color="orange">Fichier trop volumineux</Tag>
  }
  if (row.status === 'invalid_period') {
    return <Tag color="orange">Période invalide</Tag>
  }
  if (row.status === 'checking') {
    return <Tag color="processing">Vérification…</Tag>
  }
  if (row.status === 'not_found') {
    return <Tag color="error">Matricule non trouvé</Tag>
  }
  return <Tag color="success">Prêt</Tag>
}

export function BulkPreviewTable({
  rows,
  resolving,
  onRemove,
}: BulkPreviewTableProps) {
  const columns: ColumnsType<BulkPreviewRow> = [
    {
      title: 'Fichier',
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
      render: (name: string) => <Text>{name}</Text>,
    },
    {
      title: 'Matricule',
      dataIndex: 'matricule',
      key: 'matricule',
      width: 120,
      render: (m: string | null) => m ?? '—',
    },
    {
      title: 'Collaborateur',
      key: 'collab',
      width: 200,
      ellipsis: true,
      render: (_: unknown, row) =>
        row.collaboratorLabel != null ? (
          <Text>{row.collaboratorLabel}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Mois',
      key: 'month',
      width: 110,
      render: (_: unknown, row) =>
        row.month != null && row.month >= 1 && row.month <= 12
          ? MONTHS_FR[row.month - 1]
          : '—',
    },
    {
      title: 'Année',
      dataIndex: 'year',
      key: 'year',
      width: 88,
      render: (y: number | null) => (y != null ? String(y) : '—'),
    },
    {
      title: 'Statut',
      key: 'status',
      width: 168,
      render: (_: unknown, row) => statusTag(row),
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      fixed: 'right',
      render: (_: unknown, row) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<CloseOutlined />}
          aria-label="Retirer"
          onClick={() => onRemove(row.key)}
        />
      ),
    },
  ]

  return (
    <Table<BulkPreviewRow>
      rowKey="key"
      size="small"
      loading={resolving}
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 900 }}
    />
  )
}
