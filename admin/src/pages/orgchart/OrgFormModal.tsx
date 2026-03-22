import { App, Form, Input, Modal, Select } from 'antd'
import { useEffect, useState } from 'react'
import * as orgApi from '../../services/org.service'
import { adminTheme } from '../../theme/adminTheme'
import { ORG_TREE_UNASSIGNED_DIRECTION_ID } from '../../types/orgTree'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'

export type OrgFormEntity = 'direction' | 'department' | 'service'

export interface OrgFormModalProps {
  open: boolean
  entity: OrgFormEntity
  mode: 'create' | 'edit'
  recordId?: string | null
  initialName?: string
  defaultDirectionId?: string | null
  defaultDepartmentId?: string | null
  directionOptions: { value: string; label: string }[]
  departmentOptions: { value: string; label: string }[]
  onClose: () => void
  onSuccess: () => void
}

export function OrgFormModal({
  open,
  entity,
  mode,
  recordId,
  initialName,
  defaultDirectionId,
  defaultDepartmentId,
  directionOptions,
  departmentOptions,
  onClose,
  onSuccess,
}: OrgFormModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<{
    name: string
    directionId?: string | null
    departmentId?: string | null
  }>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (entity === 'direction') {
      form.setFieldsValue({
        name: mode === 'edit' ? (initialName ?? '') : '',
      })
      return
    }
    if (entity === 'department') {
      form.setFieldsValue({
        name: mode === 'edit' ? (initialName ?? '') : '',
        directionId:
          mode === 'create'
            ? defaultDirectionId === ORG_TREE_UNASSIGNED_DIRECTION_ID ||
              defaultDirectionId == null
              ? undefined
              : defaultDirectionId
            : defaultDirectionId != null
              ? defaultDirectionId
              : undefined,
      })
      return
    }
    form.setFieldsValue({
      name: mode === 'edit' ? (initialName ?? '') : '',
      departmentId:
        defaultDepartmentId != null
          ? defaultDepartmentId
          : undefined,
    })
  }, [
    open,
    entity,
    mode,
    initialName,
    defaultDirectionId,
    defaultDepartmentId,
    form,
  ])

  const title =
    entity === 'direction'
      ? mode === 'create'
        ? 'Ajouter une direction'
        : 'Modifier une direction'
      : entity === 'department'
        ? mode === 'create'
          ? 'Ajouter un département'
          : 'Modifier un département'
        : mode === 'create'
          ? 'Ajouter un service'
          : 'Modifier un service'

  async function submit() {
    try {
      const v = await form.validateFields()
      setSaving(true)
      const name = v.name.trim()
      if (entity === 'direction') {
        if (mode === 'create') {
          await orgApi.createDirection(name)
        } else if (recordId) {
          await orgApi.updateDirection(recordId, name)
        }
      } else if (entity === 'department') {
        const dirId = v.directionId
        if (mode === 'create') {
          await orgApi.createDepartment({
            name,
            directionId: dirId || undefined,
          })
        } else if (recordId) {
          await orgApi.updateDepartment(recordId, {
            name,
            directionId: dirId ?? null,
          })
        }
      } else {
        const depId = v.departmentId
        if (mode === 'create') {
          await orgApi.createService({
            name,
            departmentId: depId || undefined,
          })
        } else if (recordId) {
          await orgApi.updateService(recordId, {
            name,
            departmentId: depId ?? null,
          })
        }
      }
      message.success('Enregistré')
      onSuccess()
      onClose()
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Enregistrement impossible'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      okText="Enregistrer"
      confirmLoading={saving}
      onOk={() => void submit()}
      destroyOnHidden
      okButtonProps={{
        style: {
          background: adminTheme.teal,
          borderColor: adminTheme.teal,
        },
      }}
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          name="name"
          label="Nom"
          rules={[{ required: true, message: 'Requis' }]}
        >
          <Input />
        </Form.Item>
        {entity === 'department' ? (
          <Form.Item name="directionId" label="Direction (optionnel)">
            <Select
              allowClear
              placeholder="Sans direction"
              options={directionOptions}
            />
          </Form.Item>
        ) : null}
        {entity === 'service' ? (
          <Form.Item name="departmentId" label="Département (optionnel)">
            <Select
              allowClear
              placeholder="Sans département"
              options={departmentOptions}
            />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  )
}
