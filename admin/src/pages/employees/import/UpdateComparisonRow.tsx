import { Table } from 'antd'
import type { ImportRowDto } from '../../../types/employees'

export type UpdateComparisonRowProps = {
  existingData: {
    firstName: string
    lastName: string
    email: string
    position?: string | null
    department?: string | null
    service?: string | null
  }
  newData: ImportRowDto
}

function norm(s: string | undefined | null): string {
  return (s ?? '').trim()
}

export function UpdateComparisonRow({
  existingData,
  newData,
}: UpdateComparisonRowProps) {
  const rows: {
    key: string
    label: string
    base: string
    file: string
    diff: boolean
  }[] = [
    {
      key: 'position',
      label: 'Poste',
      base: norm(existingData.position) || '(aucun)',
      file: norm(newData.position) || '(aucun)',
      diff:
        norm(existingData.position).toLowerCase() !==
        norm(newData.position).toLowerCase(),
    },
    {
      key: 'dept',
      label: 'Département',
      base: norm(existingData.department) || '(aucun)',
      file: norm(newData.departmentName) || '(aucun)',
      diff:
        norm(existingData.department).toLowerCase() !==
        norm(newData.departmentName).toLowerCase(),
    },
    {
      key: 'svc',
      label: 'Service',
      base: norm(existingData.service) || '(aucun)',
      file: norm(newData.serviceName) || '(aucun)',
      diff:
        norm(existingData.service).toLowerCase() !==
        norm(newData.serviceName).toLowerCase(),
    },
    {
      key: 'fn',
      label: 'Prénom',
      base: norm(existingData.firstName),
      file: norm(newData.firstName),
      diff:
        norm(existingData.firstName).toLowerCase() !==
        norm(newData.firstName).toLowerCase(),
    },
    {
      key: 'ln',
      label: 'Nom',
      base: norm(existingData.lastName),
      file: norm(newData.lastName),
      diff:
        norm(existingData.lastName).toLowerCase() !==
        norm(newData.lastName).toLowerCase(),
    },
    {
      key: 'em',
      label: 'E-mail',
      base: norm(existingData.email),
      file: norm(newData.email),
      diff:
        norm(existingData.email).toLowerCase() !==
        norm(newData.email).toLowerCase(),
    },
  ]

  return (
    <Table
      size="small"
      pagination={false}
      rowKey="key"
      dataSource={rows}
      columns={[
        { title: 'Champ', dataIndex: 'label', width: 120 },
        {
          title: 'En base',
          dataIndex: 'base',
          render: (t: string, r) => (
            <span
              style={{
                background: r.diff ? 'rgba(41, 128, 185, 0.12)' : 'transparent',
                padding: '2px 6px',
                borderRadius: 4,
                color: r.diff ? '#1C2833' : '#7F8C8D',
                fontSize: 12,
              }}
            >
              {t}
            </span>
          ),
        },
        {
          title: 'Fichier',
          dataIndex: 'file',
          render: (t: string, r) => (
            <span
              style={{
                background: r.diff ? 'rgba(41, 128, 185, 0.12)' : 'transparent',
                padding: '2px 6px',
                borderRadius: 4,
                color: r.diff ? '#1C2833' : '#7F8C8D',
                fontSize: 12,
              }}
            >
              {t}
            </span>
          ),
        },
      ]}
    />
  )
}
