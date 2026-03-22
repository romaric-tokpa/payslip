import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { Button, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo } from 'react'
import { adminTheme } from '../../theme/adminTheme'
import type { OrgTreeResponse } from '../../types/orgTree'
import { ORG_TREE_UNASSIGNED_DIRECTION_ID } from '../../types/orgTree'
import './org-chart.css'

export type OrgListRow = {
  key: string
  id: string
  name: string
  type: 'direction' | 'department' | 'service'
  parentName: string
  collaborators: number
  isVirtualDirection?: boolean
}

function flattenTree(data: OrgTreeResponse): OrgListRow[] {
  const rows: OrgListRow[] = []
  for (const dir of data.directions) {
    const isVirtual = dir.id === ORG_TREE_UNASSIGNED_DIRECTION_ID
    rows.push({
      key: `d:${dir.id}`,
      id: dir.id,
      name: dir.name,
      type: 'direction',
      parentName: '—',
      collaborators: dir.employeeCount,
      isVirtualDirection: isVirtual,
    })
    for (const dep of dir.departments) {
      rows.push({
        key: `dep:${dep.id}`,
        id: dep.id,
        name: dep.name,
        type: 'department',
        parentName: dir.name,
        collaborators: dep.employeeCount,
      })
      for (const svc of dep.services) {
        rows.push({
          key: `svc:${svc.id}`,
          id: svc.id,
          name: svc.name,
          type: 'service',
          parentName: dep.name,
          collaborators: svc.employeeCount,
        })
      }
    }
  }
  return rows
}

const TYPE_ORDER: Record<OrgListRow['type'], number> = {
  direction: 0,
  department: 1,
  service: 2,
}

export interface OrgListProps {
  data: OrgTreeResponse
  onEditRow: (row: OrgListRow) => void
  onDeleteRow: (row: OrgListRow) => void
}

export function OrgList({ data, onEditRow, onDeleteRow }: OrgListProps) {
  const rows = useMemo(() => flattenTree(data), [data])

  const columns: ColumnsType<OrgListRow> = useMemo(
    () => [
      {
        title: 'Nom',
        dataIndex: 'name',
        key: 'name',
        sorter: (a, b) => a.name.localeCompare(b.name, 'fr'),
      },
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        filters: [
          { text: 'Direction', value: 'direction' },
          { text: 'Département', value: 'department' },
          { text: 'Service', value: 'service' },
        ],
        onFilter: (value, record) => record.type === value,
        sorter: (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
        render: (t: OrgListRow['type']) => {
          if (t === 'direction') {
            return (
              <Tag
                style={{
                  margin: 0,
                  background: adminTheme.tealBg,
                  color: adminTheme.teal,
                  border: 'none',
                }}
              >
                Direction
              </Tag>
            )
          }
          if (t === 'department') {
            return (
              <Tag
                style={{
                  margin: 0,
                  background: adminTheme.blueBg,
                  color: adminTheme.blue,
                  border: 'none',
                }}
              >
                Département
              </Tag>
            )
          }
          return (
            <Tag
              style={{
                margin: 0,
                background: adminTheme.orangeBg,
                color: adminTheme.orange,
                border: 'none',
              }}
            >
              Service
            </Tag>
          )
        },
      },
      {
        title: 'Rattachement',
        dataIndex: 'parentName',
        key: 'parentName',
        sorter: (a, b) => a.parentName.localeCompare(b.parentName, 'fr'),
      },
      {
        title: 'Collaborateurs',
        dataIndex: 'collaborators',
        key: 'collaborators',
        width: 140,
        sorter: (a, b) => a.collaborators - b.collaborators,
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 120,
        render: (_, row) => (
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              disabled={row.type === 'direction' && row.isVirtualDirection}
              onClick={() => onEditRow(row)}
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={row.type === 'direction' && row.isVirtualDirection}
              onClick={() => onDeleteRow(row)}
            />
          </Space>
        ),
      },
    ],
    [onEditRow, onDeleteRow],
  )

  return (
    <Table<OrgListRow>
      className="orgchart-list-table"
      size="middle"
      rowKey="key"
      columns={columns}
      dataSource={rows}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      rowClassName={(record) =>
        record.type === 'direction'
          ? 'org-list-row-direction'
          : record.type === 'department'
            ? 'org-list-row-department'
            : 'org-list-row-service'
      }
    />
  )
}
