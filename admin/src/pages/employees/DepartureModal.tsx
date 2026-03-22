import {
  CalendarOutlined,
  TeamOutlined,
  UserDeleteOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Collapse,
  DatePicker,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Switch,
  Typography,
} from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import * as employeesApi from '../../services/employees.service'
import { adminTheme } from '../../theme/adminTheme'
import type {
  DepartureType,
  EmployeeUser,
  InitiateDepartureDto,
} from '../../types/employees'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'

const { Text } = Typography

type DepartureModalProps = {
  user: EmployeeUser
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

const DEPARTURE_OPTIONS: {
  value: DepartureType
  label: string
  desc: string
  icon: ReactNode
  color: string
}[] = [
  {
    value: 'RESIGNATION',
    label: 'Démission',
    desc: 'Départ volontaire du collaborateur',
    icon: <UserDeleteOutlined style={{ color: '#d46b08' }} />,
    color: '#fff7e6',
  },
  {
    value: 'TERMINATION',
    label: 'Licenciement',
    desc: 'Rupture à l’initiative de l’employeur',
    icon: <WarningOutlined style={{ color: '#cf1322' }} />,
    color: '#fff1f0',
  },
  {
    value: 'CONTRACT_END',
    label: 'Fin de contrat',
    desc: 'CDD, mission ou stage arrivé à terme',
    icon: <CalendarOutlined style={{ color: '#531dab' }} />,
    color: '#f9f0ff',
  },
  {
    value: 'RETIREMENT',
    label: 'Retraite',
    desc: 'Départ en retraite',
    icon: <CalendarOutlined style={{ color: '#595959' }} />,
    color: '#f5f5f5',
  },
  {
    value: 'MUTUAL_AGREEMENT',
    label: 'Rupture conventionnelle',
    desc: 'Accord mutuel',
    icon: <TeamOutlined style={{ color: '#1677ff' }} />,
    color: '#e6f4ff',
  },
]

function departmentLabel(row: EmployeeUser): string {
  return row.orgDepartment?.name ?? row.department ?? '—'
}

export function DepartureModal({
  user,
  visible,
  onClose,
  onSuccess,
}: DepartureModalProps) {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<{
    departureType: DepartureType
    reason?: string
    departureDate: Dayjs
    notice: boolean
    noticeEndDate?: Dayjs
  }>()
  const [loading, setLoading] = useState(false)
  const [noticeOn, setNoticeOn] = useState(false)

  const depType = Form.useWatch('departureType', form)
  const endContract = user.contractEndDate
    ? dayjs(user.contractEndDate)
    : null

  useEffect(() => {
    if (!visible) {
      return
    }
    const hasFixedTerm =
      !!user.contractEndDate &&
      user.contractType != null &&
      ['CDD', 'INTERIM', 'STAGE'].includes(user.contractType)
    const defaultType: DepartureType = hasFixedTerm
      ? 'CONTRACT_END'
      : 'RESIGNATION'
    const d =
      defaultType === 'CONTRACT_END' && endContract ? endContract : dayjs()
    form.setFieldsValue({
      departureType: defaultType,
      departureDate: d,
      notice: false,
      reason: undefined,
      noticeEndDate: d,
    })
    setNoticeOn(false)
  }, [visible, form, endContract])

  useEffect(() => {
    if (!visible || !depType) {
      return
    }
    const cur = form.getFieldValue('departureDate') as Dayjs | undefined
    if (depType === 'CONTRACT_END' && endContract) {
      form.setFieldValue('departureDate', endContract)
      if (!noticeOn) {
        form.setFieldValue('noticeEndDate', endContract)
      }
    } else if (depType !== 'CONTRACT_END' && cur?.isSame(endContract, 'day')) {
      form.setFieldValue('departureDate', dayjs())
    }
  }, [depType, visible, form, endContract, noticeOn])

  const onFinish = async () => {
    const v = await form.validateFields()
    const dto: InitiateDepartureDto = {
      departureType: v.departureType,
      departureDate: v.departureDate.startOf('day').toISOString(),
      reason: v.reason?.trim() || undefined,
      noticeEndDate:
        v.notice && v.noticeEndDate
          ? v.noticeEndDate.startOf('day').toISOString()
          : undefined,
    }
    modal.confirm({
      title: 'Confirmer le départ',
      content: `Enregistrer le départ de ${user.firstName} ${user.lastName} ? Cette action peut être annulée via la réintégration.`,
      okText: 'Confirmer',
      okButtonProps: { danger: true },
      onOk: async () => {
        setLoading(true)
        try {
          await employeesApi.initiateDepart(user.id, dto)
          message.success('Départ enregistré')
          onSuccess()
          onClose()
        } catch (e) {
          message.error(getApiErrorMessage(e, 'Enregistrement impossible'))
          throw e
        } finally {
          setLoading(false)
        }
      },
    })
  }

  const title = useMemo(
    () => `Enregistrer un départ — ${user.firstName} ${user.lastName}`,
    [user],
  )

  return (
    <Modal
      title={title}
      open={visible}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={640}
    >
      <Card
        size="small"
        style={{ marginBottom: 16, background: adminTheme.tealBg }}
        styles={{ body: { padding: 12 } }}
      >
        <Space align="start">
          <div>
            <Text strong>
              {user.firstName} {user.lastName}
            </Text>
            <div style={{ fontSize: 12, color: '#666' }}>
              {user.employeeId ?? '—'} · {departmentLabel(user)} ·{' '}
              {user.position ?? '—'}
            </div>
          </div>
        </Space>
      </Card>

      <Form form={form} layout="vertical" onFinish={() => void onFinish()}>
        <Form.Item
          name="departureType"
          label="Type de départ"
          rules={[{ required: true }]}
        >
          <Radio.Group style={{ width: '100%' }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {DEPARTURE_OPTIONS.map((o) => (
                <Radio key={o.value} value={o.value} style={{ width: '100%' }}>
                  <Card
                    size="small"
                    styles={{ body: { padding: 8 } }}
                    style={{
                      background: o.color,
                      borderColor: '#eee',
                      width: '100%',
                    }}
                  >
                    <Space>
                      {o.icon}
                      <div>
                        <div style={{ fontWeight: 600 }}>{o.label}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {o.desc}
                        </div>
                      </div>
                    </Space>
                  </Card>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(p, c) => p.departureType !== c.departureType}
        >
          {() => (
            <Form.Item
              name="reason"
              label="Motif"
              rules={
                form.getFieldValue('departureType') === 'TERMINATION'
                  ? [{ required: true, message: 'Obligatoire pour licenciement' }]
                  : []
              }
            >
              <Input.TextArea
                rows={3}
                maxLength={500}
                showCount
                placeholder="Précisez la raison du départ (obligatoire pour un licenciement)"
              />
            </Form.Item>
          )}
        </Form.Item>

        <Form.Item
          name="departureDate"
          label="Date effective de départ"
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item label="Préavis">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Switch
              checked={noticeOn}
              onChange={(c) => {
                setNoticeOn(c)
                form.setFieldValue('notice', c)
                const dep = form.getFieldValue('departureDate') as Dayjs
                if (c && dep) {
                  form.setFieldValue('noticeEndDate', dep)
                }
              }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Le collaborateur effectue un préavis
            </Text>
          </Space>
        </Form.Item>

        {noticeOn ? (
          <Form.Item
            name="noticeEndDate"
            label="Date de fin de préavis"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        ) : null}

        {noticeOn ? (
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            Le collaborateur recevra encore ses bulletins pendant le préavis.
            Son compte sera gelé automatiquement à la fin du préavis.
          </Typography.Paragraph>
        ) : null}

        <Collapse
          size="small"
          items={[
            {
              key: '1',
              label: 'Conséquences',
              children: (
                <div
                  style={{
                    fontSize: 13,
                    background: adminTheme.orangeBg,
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Exclusion des prochaines distributions de bulletins</li>
                    <li>Accès mobile en lecture seule pendant la période légale</li>
                    <li>
                      {!noticeOn
                        ? 'Sessions actives invalidées immédiatement'
                        : 'Sessions invalidées à la fin du préavis'}
                    </li>
                    <li>Anciens bulletins conservés (obligation légale)</li>
                  </ul>
                </div>
              ),
            },
          ]}
        />

        <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
          <Space>
            <Button onClick={onClose}>Annuler</Button>
            <Button
              type="primary"
              danger
              htmlType="submit"
              loading={loading}
            >
              Confirmer le départ
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
