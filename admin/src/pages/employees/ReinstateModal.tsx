import { App, Button, DatePicker, Form, Modal, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import * as employeesApi from '../../services/employees.service'
import { adminTheme } from '../../theme/adminTheme'
import type { EmployeeUser } from '../../types/employees'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'

type ReinstateModalProps = {
  user: EmployeeUser
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ReinstateModal({
  user,
  open,
  onClose,
  onSuccess,
}: ReinstateModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{ newContractEndDate?: dayjs.Dayjs }>()
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const v = await form.validateFields()
    setLoading(true)
    try {
      await employeesApi.reinstateUser(
        user.id,
        v.newContractEndDate
          ? {
              newContractEndDate: v.newContractEndDate
                .startOf('day')
                .toISOString(),
            }
          : {},
      )
      message.success('Collaborateur réintégré')
      onSuccess()
      onClose()
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Réintégration impossible'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={`Réintégrer ${user.firstName} ${user.lastName} ?`}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Typography.Paragraph
        style={{ background: adminTheme.tealBg, padding: 12, borderRadius: 8 }}
      >
        Le collaborateur retrouvera l’accès complet et sera inclus dans les
        distributions de bulletins.
      </Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item name="newContractEndDate" label="Nouvelle date de fin de contrat (optionnel)">
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>
            Annuler
          </Button>
          <Button type="primary" loading={loading} onClick={() => void submit()}>
            Réintégrer
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
