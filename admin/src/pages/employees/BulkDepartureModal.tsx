import { UserDeleteOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Collapse,
  DatePicker,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Table,
} from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useState } from 'react'
import * as employeesApi from '../../services/employees.service'
import type {
  BulkDepartureDto,
  DepartureType,
  EmployeeUser,
} from '../../types/employees'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'

const DEPARTURE_LABELS: Record<DepartureType, string> = {
  RESIGNATION: 'Démission',
  TERMINATION: 'Licenciement',
  CONTRACT_END: 'Fin de contrat',
  RETIREMENT: 'Retraite',
  MUTUAL_AGREEMENT: 'Rupture conventionnelle',
}

type BulkDepartureModalProps = {
  open: boolean
  employees: EmployeeUser[]
  onClose: () => void
  onSuccess: () => void
}

export function BulkDepartureModal({
  open,
  employees,
  onClose,
  onSuccess,
}: BulkDepartureModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{
    departureType: DepartureType
    departureDate: Dayjs
    reason?: string
  }>()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)

  const n = employees.length

  const submit = async () => {
    const v = await form.validateFields()
    const dto: BulkDepartureDto = {
      userIds: employees.map((e) => e.id),
      departureType: v.departureType,
      departureDate: v.departureDate.startOf('day').toISOString(),
      reason: v.reason?.trim() || undefined,
    }
    setLoading(true)
    setProgress(30)
    try {
      const res = await employeesApi.bulkDepart(dto)
      setProgress(100)
      message.success(
        `${res.departed} départs enregistrés${res.errors.length > 0 ? `, ${res.errors.length} erreurs` : ''}`,
      )
      onSuccess()
      onClose()
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Départ en masse impossible'))
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <UserDeleteOutlined style={{ color: '#cf1322' }} />
          <span>Départ en masse ({n})</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={720}
    >
      <p style={{ marginBottom: 16 }}>
        Vous allez enregistrer le départ de <strong>{n}</strong> collaborateurs.
        Pas de préavis en masse : utilisez la fiche individuelle si besoin.
      </p>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          departureType: 'CONTRACT_END' as DepartureType,
          departureDate: dayjs(),
        }}
      >
        <Form.Item
          name="departureType"
          label="Type de départ"
          rules={[{ required: true }]}
        >
          <Select
            options={(Object.keys(DEPARTURE_LABELS) as DepartureType[]).map(
              (k) => ({ value: k, label: DEPARTURE_LABELS[k] }),
            )}
          />
        </Form.Item>
        <Form.Item
          name="departureDate"
          label="Date effective"
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item name="reason" label="Motif (optionnel)">
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
      </Form>

      <Collapse
        size="small"
        style={{ marginBottom: 12 }}
        items={[
          {
            key: 'list',
            label: `Collaborateurs concernés (${n})`,
            children: (
              <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={employees}
                columns={[
                  {
                    title: 'Nom',
                    key: 'name',
                    render: (_, r) => `${r.lastName} ${r.firstName}`,
                  },
                  { title: 'Matricule', dataIndex: 'employeeId' },
                  {
                    title: 'Département',
                    key: 'd',
                    render: (_, r) =>
                      r.orgDepartment?.name ?? r.department ?? '—',
                  },
                ]}
              />
            ),
          },
        ]}
      />

      {progress != null ? <Progress percent={progress} size="small" /> : null}

      <Space style={{ marginTop: 16 }}>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          type="primary"
          danger
          loading={loading}
          onClick={() => void submit()}
        >
          Confirmer les {n} départs
        </Button>
      </Space>
    </Modal>
  )
}
