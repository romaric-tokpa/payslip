import { Card, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo } from 'react'
import type { PreviewRow } from './importPreviewLogic'
import './import-flow.css'

type ImportPreviewStepProps = {
  previewRows: PreviewRow[]
  selectedKeys: number[]
  onSelectedKeysChange: (keys: number[]) => void
  previewStats: { ok: number; errors: number }
}

export function ImportPreviewStep({
  previewRows,
  selectedKeys,
  onSelectedKeysChange,
  previewStats,
}: ImportPreviewStepProps) {
  const columns: ColumnsType<PreviewRow> = useMemo(
    () => [
      {
        title: 'LN',
        dataIndex: 'line',
        width: 56,
        className: 'import-preview-col-ln',
      },
      {
        title: 'Matricule',
        dataIndex: 'matricule',
        width: 110,
        render: (v: string) => (
          <span style={{ fontWeight: 700, color: '#1C2833' }}>{v}</span>
        ),
      },
      { title: 'Prénom', dataIndex: 'prenom', width: 100, ellipsis: true },
      { title: 'Nom', dataIndex: 'nom', width: 100, ellipsis: true },
      {
        title: 'Email',
        dataIndex: 'email',
        ellipsis: true,
        render: (v: string) => (
          <span style={{ fontSize: 11, color: '#7F8C8D' }}>{v}</span>
        ),
      },
      {
        title: 'Département',
        dataIndex: 'departement',
        width: 120,
        ellipsis: true,
        render: (v: string) => (
          <span style={{ fontSize: 11, color: '#7F8C8D' }}>{v || '—'}</span>
        ),
      },
      {
        title: 'Service',
        dataIndex: 'service',
        width: 120,
        ellipsis: true,
        render: (v: string) => (
          <span style={{ fontSize: 11, color: '#7F8C8D' }}>{v || '—'}</span>
        ),
      },
      {
        title: 'Statut',
        width: 220,
        render: (_: unknown, r: PreviewRow) =>
          r.status === 'ok' ? (
            <Tag className="import-status-tag-ok">OK</Tag>
          ) : (
            <Tag className="import-status-tag-err">
              {r.errorMessage ?? 'Erreur'}
            </Tag>
          ),
      },
    ],
    [],
  )

  return (
    <div className="import-preview-step">
      <div className="import-preview-counters">
        <div className="import-preview-counter import-preview-counter--ok">
          <div className="import-preview-counter__label">
            Prêts à importer
          </div>
          <div className="import-preview-counter__value">
            {previewStats.ok}
          </div>
        </div>
        <div className="import-preview-counter import-preview-counter--err">
          <div className="import-preview-counter__label">Erreurs</div>
          <div className="import-preview-counter__value">
            {previewStats.errors}
          </div>
        </div>
      </div>

      <Card
        className="import-preview-table-card"
        variant="outlined"
        styles={{ body: { padding: 0 } }}
      >
        <Table<PreviewRow>
          className="import-preview-table"
          size="small"
          rowKey="key"
          pagination={{ pageSize: 15, showSizeChanger: true, size: 'small' }}
          columns={columns}
          dataSource={previewRows}
          rowClassName={(record) =>
            record.status === 'error' ? 'import-preview-row-error' : ''
          }
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => onSelectedKeysChange(keys as number[]),
            getCheckboxProps: (record) => ({
              disabled: record.status !== 'ok',
            }),
          }}
        />
      </Card>

      <p className="import-preview-note">
        Les lignes en erreur seront ignorées
      </p>
    </div>
  )
}
