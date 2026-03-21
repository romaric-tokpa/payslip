import { App, Form, Input, Modal, Select } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type { EmployeeUser } from '../../types/employees'
import type { OrgDepartment, OrgService } from '../../types/organization'
import * as employeesApi from '../../services/employees.service'
import * as orgApi from '../../services/organization.service'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'

const TEAL = '#0F5C5E'

export type EmployeeFormModalMode = 'create' | 'edit'

type FormValues = {
  employeeId: string
  firstName: string
  lastName: string
  email: string
  departmentId?: string
  serviceId?: string
  position?: string
}

export type EmployeeFormSuccess =
  | {
      kind: 'create'
      email: string
      activationCode: string
      activationUrl: string
    }
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

function eligibleServicesForDepartment(
  all: OrgService[],
  departmentId: string | undefined,
): OrgService[] {
  return all.filter(
    (s) =>
      s.departmentId == null || s.departmentId === departmentId,
  )
}

export function EmployeeFormModal({
  open,
  mode,
  employee,
  onClose,
  onSuccess,
}: EmployeeFormModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const departmentId = Form.useWatch('departmentId', form)
  const [submitting, setSubmitting] = useState(false)
  const [orgLoading, setOrgLoading] = useState(false)
  const [departments, setDepartments] = useState<OrgDepartment[]>([])
  const [allServices, setAllServices] = useState<OrgService[]>([])

  const serviceOptions = useMemo(() => {
    return eligibleServicesForDepartment(
      allServices,
      departmentId ?? undefined,
    )
  }, [allServices, departmentId])

  useEffect(() => {
    if (!open) {
      return
    }
    setOrgLoading(true)
    void Promise.all([orgApi.listDepartments(), orgApi.listServices()])
      .then(([depts, svcs]) => {
        setDepartments(depts)
        setAllServices(svcs)
      })
      .catch((e) => {
        message.error(
          getApiErrorMessage(e, 'Impossible de charger départements / services'),
        )
      })
      .finally(() => setOrgLoading(false))
  }, [open, message])

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
        departmentId: employee.departmentId ?? undefined,
        serviceId: employee.serviceId ?? undefined,
        position: employee.position ?? '',
      })
    } else {
      form.resetFields()
    }
  }, [open, mode, employee, form])

  useEffect(() => {
    if (!open || orgLoading) {
      return
    }
    const dept = form.getFieldValue('departmentId') as string | undefined
    const eligible = eligibleServicesForDepartment(allServices, dept)
    const sid = form.getFieldValue('serviceId') as string | undefined
    if (sid && !eligible.some((s) => s.id === sid)) {
      form.setFieldValue('serviceId', undefined)
    }
  }, [open, orgLoading, allServices, departmentId, form])

  async function handleOk() {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (mode === 'create') {
        const email = values.email.trim().toLowerCase()
        const invite = await employeesApi.createEmployee({
          email,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          employeeId: values.employeeId.trim(),
          position: emptyToUndefined(values.position),
          ...(values.departmentId
            ? { departmentId: values.departmentId }
            : {}),
          ...(values.serviceId ? { serviceId: values.serviceId } : {}),
        })
        onSuccess({
          kind: 'create',
          email,
          activationCode: invite.activationCode,
          activationUrl: invite.activationUrl,
        })
      } else if (employee) {
        await employeesApi.updateEmployee(employee.id, {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim().toLowerCase(),
          position: emptyToUndefined(values.position),
          departmentId:
            values.departmentId != null && values.departmentId !== ''
              ? values.departmentId
              : null,
          serviceId:
            values.serviceId != null && values.serviceId !== ''
              ? values.serviceId
              : null,
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
          name="departmentId"
          label="Département"
          tooltip="Configurez les départements dans Organisation."
        >
          <Select
            allowClear
            placeholder="Aucun"
            loading={orgLoading}
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
          />
        </Form.Item>
        <Form.Item
          name="serviceId"
          label="Service"
          tooltip="Services sans département sont toujours proposés ; avec un département, les services du même département le sont aussi."
        >
          <Select
            allowClear
            placeholder="Aucun"
            loading={orgLoading}
            options={serviceOptions.map((s) => ({
              label:
                s.departmentId == null
                  ? `${s.name} (sans département)`
                  : s.name,
              value: s.id,
            }))}
          />
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
