import { App, Button, Col, DatePicker, Divider, Form, Input, Modal, Row, Select } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { useEffect, useMemo, useState } from 'react'
import type { ContractType, EmployeeUser } from '../../types/employees'
import type { OrgDepartment, OrgService } from '../../types/organization'
import * as employeesApi from '../../services/employees.service'
import * as orgApi from '../../services/organization.service'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'

dayjs.locale('fr')

export type EmployeeFormModalMode = 'create' | 'edit'

type FormValues = {
  employeeId: string
  firstName: string
  lastName: string
  email: string
  departmentId?: string
  serviceId?: string
  position?: string
  contractType?: ContractType | null
  entryDate?: Dayjs | null
  contractEndDate?: Dayjs | null
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
    (s) => s.departmentId == null || s.departmentId === departmentId,
  )
}

const CONTRACT_OPTIONS: { value: ContractType; label: string }[] = [
  { value: 'CDI', label: 'CDI — Contrat à durée indéterminée' },
  { value: 'CDD', label: 'CDD — Contrat à durée déterminée' },
  { value: 'INTERIM', label: 'Intérim — Mission temporaire' },
  { value: 'STAGE', label: 'Stage' },
]

function needsEndDate(ct: ContractType | null | undefined): boolean {
  return ct === 'CDD' || ct === 'INTERIM' || ct === 'STAGE'
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
  const contractType = Form.useWatch('contractType', form)
  const entryDate = Form.useWatch('entryDate', form)
  const contractEndDate = Form.useWatch('contractEndDate', form)
  const [submitting, setSubmitting] = useState(false)
  const [orgLoading, setOrgLoading] = useState(false)
  const [departments, setDepartments] = useState<OrgDepartment[]>([])
  const [allServices, setAllServices] = useState<OrgService[]>([])

  const contractFieldsReadOnly =
    mode === 'edit' && employee?.employmentStatus === 'DEPARTED'

  const serviceOptions = useMemo(() => {
    return eligibleServicesForDepartment(
      allServices,
      departmentId ?? undefined,
    )
  }, [allServices, departmentId])

  const showContractEnd = needsEndDate(contractType ?? undefined)
  const entryInPast =
    entryDate != null && dayjs(entryDate).isBefore(dayjs(), 'day')

  const contractEndWarning =
    showContractEnd &&
    (contractEndDate == null || !contractEndDate.isValid()) &&
    !contractFieldsReadOnly

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
        contractType: employee.contractType ?? undefined,
        entryDate: employee.entryDate ? dayjs(employee.entryDate) : undefined,
        contractEndDate: employee.contractEndDate
          ? dayjs(employee.contractEndDate)
          : undefined,
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

  useEffect(() => {
    if (!showContractEnd) {
      const cur = form.getFieldValue('contractEndDate') as Dayjs | undefined
      if (cur) {
        form.setFieldValue('contractEndDate', undefined)
      }
    }
  }, [showContractEnd, form])

  async function handleSubmit() {
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
          ...(values.contractType
            ? { contractType: values.contractType }
            : {}),
          ...(values.contractEndDate?.isValid()
            ? { contractEndDate: values.contractEndDate.toISOString() }
            : {}),
          ...(values.entryDate?.isValid()
            ? { entryDate: values.entryDate.toISOString() }
            : {}),
        })
        onSuccess({
          kind: 'create',
          email,
          activationCode: invite.activationCode,
          activationUrl: invite.activationUrl,
        })
      } else if (employee) {
        const endNeeded = needsEndDate(values.contractType ?? undefined)
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
          ...(!contractFieldsReadOnly
            ? {
                contractType: values.contractType ?? null,
                contractEndDate: endNeeded
                  ? values.contractEndDate?.isValid()
                    ? values.contractEndDate.toISOString()
                    : null
                  : null,
                entryDate: values.entryDate?.isValid()
                  ? values.entryDate.toISOString()
                  : null,
              }
            : {}),
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
    mode === 'create' ? 'Nouveau collaborateur' : 'Modifier le collaborateur'

  const footer = (
    <div className="employee-form-modal__footer">
      <Button variant="outlined" onClick={onClose}>
        Annuler
      </Button>
      <Button
        type="primary"
        loading={submitting}
        onClick={() => void handleSubmit()}
        className="employees-btn-primary-teal"
      >
        {mode === 'create' ? 'Créer et inviter' : 'Enregistrer'}
      </Button>
    </div>
  )

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={footer}
      destroyOnHidden
      afterClose={() => form.resetFields()}
      className="employee-form-modal"
      styles={{
        body: { paddingTop: 8 },
      }}
      width={640}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        style={{ marginTop: 8 }}
      >
        <Divider plain style={{ margin: '0 0 12px', fontSize: 11, color: '#888' }}>
          Identité
        </Divider>
        <Row gutter={16}>
          <Col span={12}>
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
          </Col>
          <Col span={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Email requis' },
                { type: 'email', message: 'Email invalide' },
              ]}
            >
              <Input autoComplete="email" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
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
          </Col>
          <Col span={12}>
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
          </Col>
        </Row>

        <Divider plain style={{ margin: '16px 0 12px', fontSize: 11, color: '#888' }}>
          Poste
        </Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="departmentId"
              label="Département"
              tooltip="Configurez les départements dans Organisation."
            >
              <Select
                allowClear
                placeholder="Sélectionner"
                loading={orgLoading}
                options={departments.map((d) => ({ label: d.name, value: d.id }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
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
          </Col>
        </Row>
        <Form.Item
          name="position"
          label="Poste"
          rules={[{ max: 120, message: 'Maximum 120 caractères' }]}
        >
          <Input placeholder="Optionnel" />
        </Form.Item>

        <Divider plain style={{ margin: '16px 0 12px', fontSize: 11, color: '#888' }}>
          Contrat
        </Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="contractType" label="Type de contrat">
              <Select
                allowClear
                placeholder="Sélectionnez le type de contrat"
                disabled={contractFieldsReadOnly}
                options={CONTRACT_OPTIONS}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="entryDate" label="Date d'entrée">
              <DatePicker
                className="employee-form-modal__datepicker"
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder="Date d'entrée dans l'entreprise"
                disabled={contractFieldsReadOnly}
              />
            </Form.Item>
          </Col>
        </Row>
        {showContractEnd ? (
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contractEndDate" label="Date de fin de contrat">
                <DatePicker
                  className="employee-form-modal__datepicker"
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  placeholder="JJ/MM/AAAA"
                  disabled={contractFieldsReadOnly}
                  disabledDate={(current) => {
                    if (!current || entryInPast) {
                      return false
                    }
                    return current < dayjs().startOf('day')
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        ) : null}
        {contractEndWarning ? (
          <div
            style={{
              marginTop: -8,
              marginBottom: 12,
              fontSize: 12,
              color: '#d46b08',
            }}
          >
            La date de fin est recommandée pour les contrats à durée déterminée
            — elle permet les alertes d&apos;échéance automatiques.
          </div>
        ) : null}
      </Form>
    </Modal>
  )
}
