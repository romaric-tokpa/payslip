import { Form, Input, Modal, message } from 'antd'
import { useEffect, useState } from 'react'
import type { EmployeeUser } from '../../types/employees'
import * as employeesApi from '../../services/employees.service'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'

const TEAL = '#0F5C5E'

export type EmployeeFormModalMode = 'create' | 'edit'

type FormValues = {
  employeeId: string
  firstName: string
  lastName: string
  email: string
  department?: string
  position?: string
}

export type EmployeeFormSuccess =
  | { kind: 'create'; email: string }
  | { kind: 'edit' }

type EmployeeFormModalProps = {
  open: boolean
  mode: EmployeeFormModalMode
  employee: EmployeeUser | null
  onClose: () => void
  onSuccess: (result: EmployeeFormSuccess) => void
}

function emptyToUndefined(s: string | undefined): string | undefined {
  const t = s?.trim()
  return t === '' || t == null ? undefined : t
}

export function EmployeeFormModal({
  open,
  mode,
  employee,
  onClose,
  onSuccess,
}: EmployeeFormModalProps) {
  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    if (mode === 'edit' && employee) {
      form.setFieldsValue({
        employeeId: employee.employeeId ?? '',
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        department: employee.department ?? '',
        position: employee.position ?? '',
      })
    } else {
      form.resetFields()
    }
  }, [open, mode, employee, form])

  async function handleOk() {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (mode === 'create') {
        const email = values.email.trim().toLowerCase()
        await employeesApi.createEmployee({
          email,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          employeeId: values.employeeId.trim(),
          department: emptyToUndefined(values.department),
          position: emptyToUndefined(values.position),
        })
        onSuccess({ kind: 'create', email })
      } else if (employee) {
        await employeesApi.updateEmployee(employee.id, {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim().toLowerCase(),
          department: emptyToUndefined(values.department),
          position: emptyToUndefined(values.position),
        })
        onSuccess({ kind: 'edit' })
      }
      onClose()
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Une erreur est survenue'))
    } finally {
      setSubmitting(false)
    }
  }

  const title =
    mode === 'create' ? 'Ajouter un collaborateur' : 'Modifier le collaborateur'

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={submitting}
      destroyOnHidden
      okText={mode === 'create' ? 'Inviter' : 'Enregistrer'}
      okButtonProps={{ style: { backgroundColor: TEAL } }}
      afterClose={() => form.resetFields()}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="employeeId"
          label="Matricule"
          rules={[
            { required: true, message: 'Matricule requis' },
            { max: 64, message: 'Maximum 64 caractères' },
          ]}
        >
          <Input
            placeholder="EMP-1024"
            disabled={mode === 'edit'}
            autoComplete="off"
          />
        </Form.Item>
        <Form.Item
          name="firstName"
          label="Prénom"
          rules={[
            { required: true, message: 'Prénom requis' },
            { max: 120, message: 'Maximum 120 caractères' },
          ]}
        >
          <Input autoComplete="given-name" />
        </Form.Item>
        <Form.Item
          name="lastName"
          label="Nom"
          rules={[
            { required: true, message: 'Nom requis' },
            { max: 120, message: 'Maximum 120 caractères' },
          ]}
        >
          <Input autoComplete="family-name" />
        </Form.Item>
        <Form.Item
          name="email"
          label="E-mail"
          rules={[
            { required: true, message: 'E-mail requis' },
            { type: 'email', message: 'E-mail invalide' },
          ]}
        >
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item
          name="department"
          label="Département"
          rules={[{ max: 120, message: 'Maximum 120 caractères' }]}
        >
          <Input placeholder="Optionnel" />
        </Form.Item>
        <Form.Item
          name="position"
          label="Poste"
          rules={[{ max: 120, message: 'Maximum 120 caractères' }]}
        >
          <Input placeholder="Optionnel" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
