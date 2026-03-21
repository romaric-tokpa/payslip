import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'
import * as orgApi from '../../services/organization.service'
import type { OrgDepartment, OrgDirection, OrgService } from '../../types/organization'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import '../employees/employees.css'

const { Title } = Typography
const TEAL = '#0F5C5E'

type DirectionModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; record: OrgDirection }

type DeptModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; record: OrgDepartment }

type ServiceModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; record: OrgService }

export function OrganizationPage() {
  const { message } = App.useApp()
  const [directions, setDirections] = useState<OrgDirection[]>([])
  const [departments, setDepartments] = useState<OrgDepartment[]>([])
  const [services, setServices] = useState<OrgService[]>([])
  const [loadingDirs, setLoadingDirs] = useState(true)
  const [loadingDepts, setLoadingDepts] = useState(true)
  const [loadingServices, setLoadingServices] = useState(true)

  const [dirModal, setDirModal] = useState<DirectionModalState>({ open: false })
  const [deptModal, setDeptModal] = useState<DeptModalState>({ open: false })
  const [serviceModal, setServiceModal] = useState<ServiceModalState>({
    open: false,
  })
  const [dirForm] = Form.useForm<{ name: string }>()
  const [deptForm] = Form.useForm<{ name: string; directionId?: string }>()
  const [serviceForm] = Form.useForm<{
    name: string
    departmentId?: string | null
  }>()
  const [savingDir, setSavingDir] = useState(false)
  const [savingDept, setSavingDept] = useState(false)
  const [savingService, setSavingService] = useState(false)

  const loadDirections = useCallback(async () => {
    setLoadingDirs(true)
    try {
      const data = await orgApi.listDirections()
      setDirections(data)
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les directions'),
      )
    } finally {
      setLoadingDirs(false)
    }
  }, [message])

  const loadDepartments = useCallback(async () => {
    setLoadingDepts(true)
    try {
      const data = await orgApi.listDepartments()
      setDepartments(data)
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'Impossible de charger les départements'),
      )
    } finally {
      setLoadingDepts(false)
    }
  }, [message])

  const loadServices = useCallback(async () => {
    setLoadingServices(true)
    try {
      const data = await orgApi.listServices()
      setServices(data)
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Impossible de charger les services'))
    } finally {
      setLoadingServices(false)
    }
  }, [message])

  useEffect(() => {
    void loadDirections()
    void loadDepartments()
    void loadServices()
  }, [loadDirections, loadDepartments, loadServices])

  useEffect(() => {
    if (!dirModal.open) {
      return
    }
    if (dirModal.mode === 'edit') {
      dirForm.setFieldsValue({ name: dirModal.record.name })
    } else {
      dirForm.resetFields()
    }
  }, [dirModal, dirForm])

  useEffect(() => {
    if (!deptModal.open) {
      return
    }
    if (deptModal.mode === 'edit') {
      deptForm.setFieldsValue({
        name: deptModal.record.name,
        directionId: deptModal.record.directionId ?? undefined,
      })
    } else {
      deptForm.resetFields()
    }
  }, [deptModal, deptForm])

  useEffect(() => {
    if (!serviceModal.open) {
      return
    }
    if (serviceModal.mode === 'edit') {
      serviceForm.setFieldsValue({
        name: serviceModal.record.name,
        departmentId: serviceModal.record.departmentId ?? undefined,
      })
    } else {
      serviceForm.resetFields()
    }
  }, [serviceModal, serviceForm])

  async function submitDirection() {
    try {
      const { name } = await dirForm.validateFields()
      setSavingDir(true)
      if (dirModal.open && dirModal.mode === 'create') {
        await orgApi.createDirection(name.trim())
        message.success('Direction créée')
      } else if (dirModal.open && dirModal.mode === 'edit') {
        await orgApi.updateDirection(dirModal.record.id, name.trim())
        message.success('Direction mise à jour')
      }
      setDirModal({ open: false })
      await loadDirections()
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Enregistrement impossible'))
    } finally {
      setSavingDir(false)
    }
  }

  async function submitDepartment() {
    try {
      const values = await deptForm.validateFields()
      setSavingDept(true)
      const name = values.name.trim()
      const directionId =
        values.directionId != null && values.directionId !== ''
          ? values.directionId
          : undefined
      if (deptModal.open && deptModal.mode === 'create') {
        await orgApi.createDepartment({ name, ...(directionId ? { directionId } : {}) })
        message.success('Département créé')
      } else if (deptModal.open && deptModal.mode === 'edit') {
        await orgApi.updateDepartment(deptModal.record.id, {
          name,
          directionId:
            directionId === undefined ? null : directionId,
        })
        message.success('Département mis à jour')
      }
      setDeptModal({ open: false })
      await loadDepartments()
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Enregistrement impossible'))
    } finally {
      setSavingDept(false)
    }
  }

  async function submitService() {
    try {
      const values = await serviceForm.validateFields()
      setSavingService(true)
      const name = values.name.trim()
      const dept =
        values.departmentId != null && String(values.departmentId).trim() !== ''
          ? String(values.departmentId).trim()
          : undefined
      if (serviceModal.open && serviceModal.mode === 'create') {
        await orgApi.createService({ name, departmentId: dept })
        message.success('Service créé')
      } else if (serviceModal.open && serviceModal.mode === 'edit') {
        await orgApi.updateService(serviceModal.record.id, {
          name,
          departmentId: dept === undefined ? null : dept,
        })
        message.success('Service mis à jour')
      }
      setServiceModal({ open: false })
      await loadServices()
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Enregistrement impossible'))
    } finally {
      setSavingService(false)
    }
  }

  const dirColumns: ColumnsType<OrgDirection> = [
    { title: 'Nom', dataIndex: 'name', key: 'name' },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: unknown, row) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() =>
              setDirModal({ open: true, mode: 'edit', record: row })
            }
          >
            Renommer
          </Button>
          <Popconfirm
            title="Supprimer cette direction ?"
            description="Les départements rattachés seront placés « sans direction »."
            okText="Supprimer"
            cancelText="Annuler"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await orgApi.deleteDirection(row.id)
                message.success('Direction supprimée')
                await loadDirections()
                await loadDepartments()
              } catch (e) {
                message.error(getApiErrorMessage(e, 'Suppression impossible'))
              }
            }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Supprimer
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const deptColumns: ColumnsType<OrgDepartment> = [
    { title: 'Nom', dataIndex: 'name', key: 'name' },
    {
      title: 'Direction',
      key: 'direction',
      render: (_: unknown, row) =>
        row.direction?.name ?? (
          <span style={{ color: '#999' }}>Sans direction</span>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_: unknown, row) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() =>
              setDeptModal({ open: true, mode: 'edit', record: row })
            }
          >
            Modifier
          </Button>
          <Popconfirm
            title="Supprimer ce département ?"
            description="Les services liés seront détachés ; les collaborateurs perdront cette affectation."
            okText="Supprimer"
            cancelText="Annuler"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await orgApi.deleteDepartment(row.id)
                message.success('Département supprimé')
                await loadDepartments()
                await loadServices()
              } catch (e) {
                message.error(getApiErrorMessage(e, 'Suppression impossible'))
              }
            }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Supprimer
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const serviceColumns: ColumnsType<OrgService> = [
    { title: 'Nom', dataIndex: 'name', key: 'name' },
    {
      title: 'Département',
      key: 'dept',
      render: (_: unknown, row) =>
        row.department?.name ?? (
          <span style={{ color: '#999' }}>Sans département</span>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: unknown, row) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() =>
              setServiceModal({ open: true, mode: 'edit', record: row })
            }
          >
            Modifier
          </Button>
          <Popconfirm
            title="Supprimer ce service ?"
            description="Les collaborateurs rattachés perdront ce service."
            okText="Supprimer"
            cancelText="Annuler"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await orgApi.deleteService(row.id)
                message.success('Service supprimé')
                await loadServices()
              } catch (e) {
                message.error(getApiErrorMessage(e, 'Suppression impossible'))
              }
            }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Supprimer
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="employees-page-header">
        <Title level={3} style={{ margin: 0 }}>
          Organisation
        </Title>
      </div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Hiérarchie optionnelle : <strong>direction</strong> →{' '}
        <strong>département</strong> → <strong>service</strong>. Un département
        peut exister sans direction, un service sans département. Les
        collaborateurs sont affectés au département et au service depuis la page
        Collaborateurs.
      </Typography.Paragraph>

      <Tabs
        items={[
          {
            key: 'directions',
            label: 'Directions',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    style={{ backgroundColor: TEAL }}
                    onClick={() => setDirModal({ open: true, mode: 'create' })}
                  >
                    Nouvelle direction
                  </Button>
                </Space>
                <Table<OrgDirection>
                  rowKey="id"
                  columns={dirColumns}
                  dataSource={directions}
                  loading={loadingDirs}
                  pagination={false}
                />
              </>
            ),
          },
          {
            key: 'departments',
            label: 'Départements',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    style={{ backgroundColor: TEAL }}
                    onClick={() => setDeptModal({ open: true, mode: 'create' })}
                  >
                    Nouveau département
                  </Button>
                </Space>
                <Table<OrgDepartment>
                  rowKey="id"
                  columns={deptColumns}
                  dataSource={departments}
                  loading={loadingDepts}
                  pagination={false}
                />
              </>
            ),
          },
          {
            key: 'services',
            label: 'Services',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    style={{ backgroundColor: TEAL }}
                    onClick={() =>
                      setServiceModal({ open: true, mode: 'create' })
                    }
                  >
                    Nouveau service
                  </Button>
                </Space>
                <Table<OrgService>
                  rowKey="id"
                  columns={serviceColumns}
                  dataSource={services}
                  loading={loadingServices}
                  pagination={false}
                />
              </>
            ),
          },
        ]}
      />

      <Modal
        title={
          dirModal.open && dirModal.mode === 'create'
            ? 'Nouvelle direction'
            : 'Renommer la direction'
        }
        open={dirModal.open}
        onCancel={() => setDirModal({ open: false })}
        onOk={() => void submitDirection()}
        confirmLoading={savingDir}
        okText="Enregistrer"
        okButtonProps={{ style: { backgroundColor: TEAL } }}
        destroyOnHidden
        afterClose={() => dirForm.resetFields()}
      >
        <Form form={dirForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Nom"
            rules={[
              { required: true, message: 'Nom requis' },
              { max: 120, message: 'Maximum 120 caractères' },
            ]}
          >
            <Input placeholder="Ex. Direction générale" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          deptModal.open && deptModal.mode === 'create'
            ? 'Nouveau département'
            : 'Modifier le département'
        }
        open={deptModal.open}
        onCancel={() => setDeptModal({ open: false })}
        onOk={() => void submitDepartment()}
        confirmLoading={savingDept}
        okText="Enregistrer"
        okButtonProps={{ style: { backgroundColor: TEAL } }}
        destroyOnHidden
        width={480}
        afterClose={() => deptForm.resetFields()}
      >
        <Form form={deptForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Nom"
            rules={[
              { required: true, message: 'Nom requis' },
              { max: 120, message: 'Maximum 120 caractères' },
            ]}
          >
            <Input placeholder="Ex. Ressources humaines" />
          </Form.Item>
          <Form.Item
            name="directionId"
            label="Direction (optionnel)"
            tooltip="Laissez vide pour un département sans direction."
          >
            <Select
              allowClear
              placeholder="Sans direction"
              options={directions.map((d) => ({
                label: d.name,
                value: d.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          serviceModal.open && serviceModal.mode === 'create'
            ? 'Nouveau service'
            : 'Modifier le service'
        }
        open={serviceModal.open}
        onCancel={() => setServiceModal({ open: false })}
        onOk={() => void submitService()}
        confirmLoading={savingService}
        okText="Enregistrer"
        okButtonProps={{ style: { backgroundColor: TEAL } }}
        destroyOnHidden
        width={480}
        afterClose={() => serviceForm.resetFields()}
      >
        <Form form={serviceForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Nom du service"
            rules={[
              { required: true, message: 'Nom requis' },
              { max: 120, message: 'Maximum 120 caractères' },
            ]}
          >
            <Input placeholder="Ex. Paie" />
          </Form.Item>
          <Form.Item
            name="departmentId"
            label="Rattachement au département (optionnel)"
            tooltip="Laissez vide pour un service sans département."
          >
            <Select
              allowClear
              placeholder="Sans département"
              options={departments.map((d) => ({
                label: d.name,
                value: d.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
