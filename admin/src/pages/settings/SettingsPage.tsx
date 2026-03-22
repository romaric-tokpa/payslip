import {
  FolderOutlined,
  HomeOutlined,
  RightOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as authApi from '../../services/auth.service'
import * as employeesApi from '../../services/employees.service'
import * as orgApi from '../../services/organization.service'
import * as settingsApi from '../../services/settings.service'
import { adminTheme } from '../../theme/adminTheme'
import type { EmployeeUser } from '../../types/employees'
import type {
  OrgDepartment,
  OrgDirection,
  OrgService,
} from '../../types/organization'
import type { MeSettingsResponse } from '../../types/settings'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './settings.css'

type OrgKind = 'directions' | 'departments' | 'services'

type OrgTableRow = {
  id: string
  name: string
  employeeCount: number
}

const ROLE_BADGE: Record<string, string> = {
  RH_ADMIN: 'RH ADMIN',
  SUPER_ADMIN: 'SUPER ADMIN',
  EMPLOYEE: 'EMPLOYEE',
}

async function fetchAllCompanyEmployees(): Promise<EmployeeUser[]> {
  const out: EmployeeUser[] = []
  let page = 1
  let totalPages = 1
  do {
    const res = await employeesApi.getEmployees({ page, limit: 100 })
    out.push(...res.data)
    totalPages = res.meta.totalPages
    page++
  } while (page <= totalPages)
  return out
}

function countByDepartmentId(
  employees: EmployeeUser[],
  departmentId: string,
): number {
  return employees.filter((e) => e.departmentId === departmentId).length
}

function countByServiceId(
  employees: EmployeeUser[],
  serviceId: string,
): number {
  return employees.filter((e) => e.serviceId === serviceId).length
}

function countByDirectionId(
  employees: EmployeeUser[],
  departments: OrgDepartment[],
  directionId: string,
): number {
  const deptIds = new Set(
    departments.filter((d) => d.directionId === directionId).map((d) => d.id),
  )
  return employees.filter(
    (e) => e.departmentId != null && deptIds.has(e.departmentId),
  ).length
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function SettingsPage() {
  const { message } = App.useApp()
  const { setSessionUser, logout } = useAuth()

  const [me, setMe] = useState<MeSettingsResponse | null>(null)
  const [loadingMe, setLoadingMe] = useState(true)

  const [companyModalOpen, setCompanyModalOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false)

  const [companyForm] = Form.useForm<{
    name: string
    rccm: string
    address: string
  }>()
  const [profileForm] = Form.useForm<{
    firstName: string
    lastName: string
    email: string
  }>()
  const [passwordForm] = Form.useForm<{
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }>()

  const [savingCompany, setSavingCompany] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const [twoFaEnabled, setTwoFaEnabled] = useState(false)
  const [emailNotifEnabled, setEmailNotifEnabled] = useState(false)

  const [sessions, setSessions] = useState<authApi.AuthSessionRow[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const [orgKind, setOrgKind] = useState<OrgKind | null>(null)
  const [orgLoading, setOrgLoading] = useState(false)
  const [directions, setDirections] = useState<OrgDirection[]>([])
  const [departments, setDepartments] = useState<OrgDepartment[]>([])
  const [services, setServices] = useState<OrgService[]>([])
  const [orgEmployees, setOrgEmployees] = useState<EmployeeUser[]>([])

  const [orgEntityForm] = Form.useForm<{
    name: string
    directionId?: string | null
    departmentId?: string | null
  }>()
  const [orgEditorOpen, setOrgEditorOpen] = useState(false)
  const [orgEditorMode, setOrgEditorMode] = useState<'create' | 'edit'>(
    'create',
  )
  const [orgEditorKind, setOrgEditorKind] = useState<OrgKind | null>(null)
  const [orgEditingId, setOrgEditingId] = useState<string | null>(null)
  const [orgSaving, setOrgSaving] = useState(false)

  const canManageOrg =
    me?.user.role === 'RH_ADMIN' && me.user.companyId != null
  const canEditCompany =
    (me?.user.role === 'RH_ADMIN' || me?.user.role === 'SUPER_ADMIN') &&
    me?.company != null

  const loadMe = useCallback(async () => {
    setLoadingMe(true)
    try {
      const data = await settingsApi.getMe()
      setMe(data)
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Une erreur est survenue'))
      setMe(null)
    } finally {
      setLoadingMe(false)
    }
  }, [message])

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const list = await authApi.listAuthSessions()
      setSessions(list)
    } catch {
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMe()
  }, [loadMe])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!companyModalOpen || !me?.company) return
    companyForm.setFieldsValue({
      name: me.company.name,
      rccm: me.company.rccm ?? '',
      address: me.company.address ?? '',
    })
  }, [companyModalOpen, me, companyForm])

  useEffect(() => {
    if (!profileModalOpen || !me?.user) return
    profileForm.setFieldsValue({
      firstName: me.user.firstName,
      lastName: me.user.lastName,
      email: me.user.email,
    })
  }, [profileModalOpen, me, profileForm])

  const openOrgModal = useCallback(
    (kind: OrgKind) => {
      if (!canManageOrg) {
        message.warning(
          'La gestion de l’organisation est réservée aux administrateurs RH.',
        )
        return
      }
      setOrgKind(kind)
    },
    [canManageOrg, message],
  )

  const reloadOrgData = useCallback(async () => {
    setOrgLoading(true)
    try {
      const [d, dep, svc, emps] = await Promise.all([
        orgApi.listDirections(),
        orgApi.listDepartments(),
        orgApi.listServices(),
        fetchAllCompanyEmployees(),
      ])
      setDirections(d)
      setDepartments(dep)
      setServices(svc)
      setOrgEmployees(emps)
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Impossible de charger l’organisation'))
    } finally {
      setOrgLoading(false)
    }
  }, [message])

  useEffect(() => {
    if (!orgKind) return
    void reloadOrgData()
  }, [orgKind, reloadOrgData])

  const orgRows: OrgTableRow[] = useMemo(() => {
    if (!orgKind) return []
    if (orgKind === 'directions') {
      return directions.map((d) => ({
        id: d.id,
        name: d.name,
        employeeCount: countByDirectionId(orgEmployees, departments, d.id),
      }))
    }
    if (orgKind === 'departments') {
      return departments.map((d) => ({
        id: d.id,
        name: d.name,
        employeeCount: countByDepartmentId(orgEmployees, d.id),
      }))
    }
    return services.map((s) => ({
      id: s.id,
      name: s.name,
      employeeCount: countByServiceId(orgEmployees, s.id),
    }))
  }, [orgKind, directions, departments, services, orgEmployees])

  const orgModalTitle =
    orgKind === 'directions'
      ? 'Directions'
      : orgKind === 'departments'
        ? 'Départements'
        : orgKind === 'services'
          ? 'Services'
          : ''

  function openOrgCreate() {
    if (!orgKind) return
    setOrgEditorMode('create')
    setOrgEditorKind(orgKind)
    setOrgEditingId(null)
    orgEntityForm.resetFields()
    if (orgKind === 'departments') {
      orgEntityForm.setFieldsValue({ directionId: undefined })
    }
    if (orgKind === 'services') {
      orgEntityForm.setFieldsValue({ departmentId: undefined })
    }
    setOrgEditorOpen(true)
  }

  const openOrgEdit = useCallback(
    (row: OrgTableRow) => {
      if (!orgKind) return
      setOrgEditorMode('edit')
      setOrgEditorKind(orgKind)
      setOrgEditingId(row.id)
      orgEntityForm.setFieldsValue({ name: row.name })
      if (orgKind === 'departments') {
        const dep = departments.find((d) => d.id === row.id)
        orgEntityForm.setFieldsValue({
          directionId: dep?.directionId ?? undefined,
        })
      }
      if (orgKind === 'services') {
        const svc = services.find((s) => s.id === row.id)
        orgEntityForm.setFieldsValue({
          departmentId: svc?.departmentId ?? undefined,
        })
      }
      setOrgEditorOpen(true)
    },
    [orgKind, departments, services, orgEntityForm],
  )

  async function submitOrgEntity() {
    if (!orgEditorKind) return
    try {
      const v = await orgEntityForm.validateFields()
      setOrgSaving(true)
      const name = v.name.trim()
      if (orgEditorMode === 'create') {
        if (orgEditorKind === 'directions') {
          await orgApi.createDirection(name)
        } else if (orgEditorKind === 'departments') {
          await orgApi.createDepartment({
            name,
            directionId: v.directionId || undefined,
          })
        } else {
          await orgApi.createService({
            name,
            departmentId: v.departmentId || undefined,
          })
        }
        message.success('Élément créé')
      } else if (orgEditingId) {
        if (orgEditorKind === 'directions') {
          await orgApi.updateDirection(orgEditingId, name)
        } else if (orgEditorKind === 'departments') {
          await orgApi.updateDepartment(orgEditingId, {
            name,
            directionId: v.directionId ?? null,
          })
        } else {
          await orgApi.updateService(orgEditingId, {
            name,
            departmentId: v.departmentId ?? null,
          })
        }
        message.success('Élément mis à jour')
      }
      setOrgEditorOpen(false)
      await reloadOrgData()
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Enregistrement impossible'))
    } finally {
      setOrgSaving(false)
    }
  }

  const deleteOrgRow = useCallback(
    async (row: OrgTableRow) => {
      if (!orgKind) return
      try {
        if (orgKind === 'directions') {
          await orgApi.deleteDirection(row.id)
        } else if (orgKind === 'departments') {
          await orgApi.deleteDepartment(row.id)
        } else {
          await orgApi.deleteService(row.id)
        }
        message.success('Supprimé')
        await reloadOrgData()
      } catch (e) {
        message.error(getApiErrorMessage(e, 'Suppression impossible'))
      }
    },
    [orgKind, message, reloadOrgData],
  )

  const orgColumns: ColumnsType<OrgTableRow> = useMemo(
    () => [
      { title: 'Nom', dataIndex: 'name', key: 'name' },
      {
        title: 'Collaborateurs',
        dataIndex: 'employeeCount',
        key: 'employeeCount',
        width: 140,
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 200,
        render: (_, row) => (
          <Space size="small">
            <Button type="link" size="small" onClick={() => openOrgEdit(row)}>
              Modifier
            </Button>
            <Popconfirm
              title="Supprimer cet élément ?"
              okText="Supprimer"
              cancelText="Annuler"
              okButtonProps={{ danger: true }}
              onConfirm={() => void deleteOrgRow(row)}
            >
              <Button type="link" size="small" danger>
                Supprimer
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [openOrgEdit, deleteOrgRow],
  )

  async function onSaveCompany() {
    if (!me?.company) return
    try {
      const values = await companyForm.validateFields()
      setSavingCompany(true)
      const data = await settingsApi.updateMyCompany({
        name: values.name?.trim(),
        rccm: values.rccm?.trim() ?? '',
        address: values.address?.trim() ?? '',
      })
      setMe(data)
      message.success('Entreprise mise à jour')
      setCompanyModalOpen(false)
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Une erreur est survenue'))
    } finally {
      setSavingCompany(false)
    }
  }

  async function onSaveProfile() {
    try {
      const values = await profileForm.validateFields()
      setSavingProfile(true)
      const data = await settingsApi.updateMe({
        firstName: values.firstName?.trim(),
        lastName: values.lastName?.trim(),
        email: values.email?.trim(),
      })
      setMe(data)
      setSessionUser(settingsApi.meUserToSessionUser(data.user))
      message.success('Profil mis à jour')
      setProfileModalOpen(false)
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Une erreur est survenue'))
    } finally {
      setSavingProfile(false)
    }
  }

  async function onChangePassword() {
    try {
      const values = await passwordForm.validateFields()
      setChangingPassword(true)
      const res = await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      message.success(res.message)
      passwordForm.resetFields()
      setPasswordModalOpen(false)
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Une erreur est survenue'))
    } finally {
      setChangingPassword(false)
    }
  }

  async function onRevokeSession(id: string) {
    setRevokingId(id)
    try {
      await authApi.revokeAuthSession(id)
      message.success('Session révoquée')
      await loadSessions()
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Révocation impossible'))
    } finally {
      setRevokingId(null)
    }
  }

  const displayUser = me?.user
  const roleBadge =
    displayUser?.role != null
      ? (ROLE_BADGE[displayUser.role] ?? displayUser.role)
      : '—'

  const orgCounts = useMemo(() => {
    return {
      departments: departments.length,
      services: services.length,
      directions: directions.length,
    }
  }, [departments.length, services.length, directions.length])

  useEffect(() => {
    if (!canManageOrg) return
    void (async () => {
      try {
        const [d, dep, svc] = await Promise.all([
          orgApi.listDirections(),
          orgApi.listDepartments(),
          orgApi.listServices(),
        ])
        setDirections(d)
        setDepartments(dep)
        setServices(svc)
      } catch {
        setDirections([])
        setDepartments([])
        setServices([])
      }
    })()
  }, [canManageOrg, me?.user.companyId])

  return (
    <div>
      <div className="settings-page-grid">
        {/* Entreprise */}
        <div className="settings-card">
          <div className="settings-card-head">
            <div
              className="settings-card-icon"
              style={{
                background: adminTheme.tealBg,
                color: adminTheme.teal,
              }}
            >
              <HomeOutlined />
            </div>
            <h2 className="settings-card-title">Entreprise</h2>
          </div>
          <div className="settings-card-body">
            {loadingMe ? (
              <div className="settings-field-value">Chargement…</div>
            ) : me?.company ? (
              <>
                <div>
                  <div className="settings-field-label">Nom</div>
                  <div className="settings-field-value">{me.company.name}</div>
                </div>
                <div>
                  <div className="settings-field-label">RCCM</div>
                  <div className="settings-field-value">
                    {me.company.rccm?.trim() ? me.company.rccm : '—'}
                  </div>
                </div>
                <div>
                  <div className="settings-field-label">Adresse</div>
                  <div
                    className={`settings-field-value${me.company.address?.trim() ? '' : ' settings-field-value--empty'}`}
                  >
                    {me.company.address?.trim()
                      ? me.company.address
                      : 'Non renseignée'}
                  </div>
                </div>
              </>
            ) : (
              <div className="settings-field-value settings-field-value--empty">
                Aucune entreprise rattachée à ce compte.
              </div>
            )}
          </div>
          <div className="settings-card-actions">
            <Button
              type="primary"
              disabled={!canEditCompany}
              onClick={() => setCompanyModalOpen(true)}
              style={{
                background: adminTheme.teal,
                borderColor: adminTheme.teal,
              }}
            >
              Modifier
            </Button>
          </div>
        </div>

        {/* Mon compte */}
        <div className="settings-card">
          <div className="settings-card-head">
            <div
              className="settings-card-icon"
              style={{
                background: adminTheme.orangeBg,
                color: adminTheme.orange,
              }}
            >
              <UserOutlined />
            </div>
            <h2 className="settings-card-title">Mon compte</h2>
          </div>
          <div className="settings-card-body">
            {displayUser ? (
              <>
                <div>
                  <div className="settings-field-label">Nom complet</div>
                  <div className="settings-field-value">
                    {displayUser.firstName} {displayUser.lastName}
                  </div>
                </div>
                <div>
                  <div className="settings-field-label">E-mail</div>
                  <div className="settings-field-value">
                    {displayUser.email}
                  </div>
                </div>
                <div>
                  <div className="settings-field-label">Rôle</div>
                  <div>
                    <Tag
                      style={{
                        margin: 0,
                        background: adminTheme.tealBg,
                        color: adminTheme.teal,
                        border: 'none',
                        fontSize: 11,
                      }}
                    >
                      {roleBadge}
                    </Tag>
                  </div>
                </div>
              </>
            ) : (
              <div className="settings-field-value settings-field-value--empty">
                —
              </div>
            )}
          </div>
          <div className="settings-card-actions">
            <Button
              type="primary"
              disabled={!displayUser}
              onClick={() => setProfileModalOpen(true)}
              style={{
                background: adminTheme.teal,
                borderColor: adminTheme.teal,
              }}
            >
              Modifier
            </Button>
            <Button
              variant="outlined"
              onClick={() => setPasswordModalOpen(true)}
            >
              Mot de passe
            </Button>
          </div>
        </div>

        {/* Organisation */}
        <div className="settings-card">
          <div className="settings-card-head">
            <div
              className="settings-card-icon"
              style={{
                background: adminTheme.blueBg,
                color: adminTheme.blue,
              }}
            >
              <FolderOutlined />
            </div>
            <h2 className="settings-card-title">Organisation</h2>
          </div>
          <div className="settings-card-body" style={{ paddingTop: 4 }}>
            <div
              role="button"
              tabIndex={0}
              className={`settings-org-row${canManageOrg ? '' : ' settings-org-row--disabled'}`}
              onClick={() => openOrgModal('departments')}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  openOrgModal('departments')
                }
              }}
            >
              <span style={{ fontSize: 13, color: adminTheme.dark }}>
                Départements
              </span>
              <Space size={6}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: adminTheme.orange,
                  }}
                >
                  {orgCounts.departments}
                </span>
                <RightOutlined style={{ color: adminTheme.grayLight }} />
              </Space>
            </div>
            <div
              role="button"
              tabIndex={0}
              className={`settings-org-row${canManageOrg ? '' : ' settings-org-row--disabled'}`}
              onClick={() => openOrgModal('services')}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  openOrgModal('services')
                }
              }}
            >
              <span style={{ fontSize: 13, color: adminTheme.dark }}>
                Services
              </span>
              <Space size={6}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: adminTheme.orange,
                  }}
                >
                  {orgCounts.services}
                </span>
                <RightOutlined style={{ color: adminTheme.grayLight }} />
              </Space>
            </div>
            <div
              role="button"
              tabIndex={0}
              className={`settings-org-row${canManageOrg ? '' : ' settings-org-row--disabled'}`}
              onClick={() => openOrgModal('directions')}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  openOrgModal('directions')
                }
              }}
            >
              <span style={{ fontSize: 13, color: adminTheme.dark }}>
                Directions
              </span>
              <Space size={6}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: adminTheme.orange,
                  }}
                >
                  {orgCounts.directions}
                </span>
                <RightOutlined style={{ color: adminTheme.grayLight }} />
              </Space>
            </div>
          </div>
        </div>

        {/* Sécurité */}
        <div className="settings-card">
          <div className="settings-card-head">
            <div
              className="settings-card-icon"
              style={{
                background: adminTheme.greenBg,
                color: adminTheme.green,
              }}
            >
              <SafetyOutlined />
            </div>
            <h2 className="settings-card-title">Sécurité</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-sec-row">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: adminTheme.dark,
                    }}
                  >
                    Authentification 2FA
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: adminTheme.grayLight,
                      marginTop: 2,
                    }}
                  >
                    Double facteur à brancher sur un fournisseur (TOTP / SMS).
                  </div>
                </div>
                <Switch
                  checked={twoFaEnabled}
                  onChange={(v) => {
                    console.log('2FA toggled', v)
                    setTwoFaEnabled(v)
                  }}
                  style={
                    twoFaEnabled
                      ? { background: adminTheme.green }
                      : undefined
                  }
                />
              </div>
            </div>
            <div className="settings-sec-row">
              <div
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  void loadSessions()
                  setSessionsModalOpen(true)
                }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault()
                    void loadSessions()
                    setSessionsModalOpen(true)
                  }
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: adminTheme.dark,
                    }}
                  >
                    Sessions actives
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: adminTheme.grayLight,
                      marginTop: 2,
                    }}
                  >
                    Appareils avec un jeton de rafraîchissement valide.
                  </div>
                </div>
                <Space size={6}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: adminTheme.orange,
                    }}
                  >
                    {sessionsLoading ? '…' : sessions.length}
                  </span>
                  <RightOutlined style={{ color: adminTheme.grayLight }} />
                </Space>
              </div>
            </div>
            <div className="settings-sec-row">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: adminTheme.dark,
                    }}
                  >
                    Notifications e-mail
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: adminTheme.grayLight,
                      marginTop: 2,
                    }}
                  >
                    Alertes produit et rappels (configuration à venir).
                  </div>
                </div>
                <Switch
                  checked={emailNotifEnabled}
                  onChange={(v) => {
                    console.log('Email notifications toggled', v)
                    setEmailNotifEnabled(v)
                  }}
                />
              </div>
            </div>
          </div>
          <div className="settings-card-actions">
            <Button danger onClick={() => void logout()}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>

      <p className="settings-footer">
        PaySlip Manager v1.0.0 — Propulsé par Yemma Solutions
      </p>

      <Modal
        title="Modifier l’entreprise"
        open={companyModalOpen}
        onCancel={() => setCompanyModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={companyForm} layout="vertical" requiredMark="optional">
          <Form.Item
            name="name"
            label="Raison sociale"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="rccm" label="RCCM">
            <Input allowClear />
          </Form.Item>
          <Form.Item name="address" label="Adresse">
            <Input.TextArea rows={3} allowClear />
          </Form.Item>
          <Space>
            <Button onClick={() => setCompanyModalOpen(false)}>Annuler</Button>
            <Button
              type="primary"
              loading={savingCompany}
              onClick={() => void onSaveCompany()}
              style={{
                background: adminTheme.teal,
                borderColor: adminTheme.teal,
              }}
            >
              Enregistrer
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="Modifier le profil"
        open={profileModalOpen}
        onCancel={() => setProfileModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={profileForm} layout="vertical" requiredMark="optional">
          <Form.Item
            name="firstName"
            label="Prénom"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Input autoComplete="given-name" />
          </Form.Item>
          <Form.Item
            name="lastName"
            label="Nom"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Input autoComplete="family-name" />
          </Form.Item>
          <Form.Item
            name="email"
            label="E-mail"
            rules={[
              { required: true, message: 'Requis' },
              { type: 'email', message: 'E-mail invalide' },
            ]}
          >
            <Input autoComplete="email" />
          </Form.Item>
          <Space>
            <Button onClick={() => setProfileModalOpen(false)}>Annuler</Button>
            <Button
              type="primary"
              loading={savingProfile}
              onClick={() => void onSaveProfile()}
              style={{
                background: adminTheme.teal,
                borderColor: adminTheme.teal,
              }}
            >
              Enregistrer
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="Changer le mot de passe"
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="currentPassword"
            label="Mot de passe actuel"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Nouveau mot de passe"
            rules={[
              { required: true, message: 'Requis' },
              { min: 8, message: '8 caractères minimum' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirmation"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Requis' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(
                    new Error('Les mots de passe ne correspondent pas'),
                  )
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Space>
            <Button onClick={() => setPasswordModalOpen(false)}>
              Annuler
            </Button>
            <Button
              type="primary"
              loading={changingPassword}
              onClick={() => void onChangePassword()}
              style={{
                background: adminTheme.teal,
                borderColor: adminTheme.teal,
              }}
            >
              Mettre à jour
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="Sessions actives"
        open={sessionsModalOpen}
        onCancel={() => setSessionsModalOpen(false)}
        footer={null}
        width={640}
        destroyOnHidden
      >
        <Table<authApi.AuthSessionRow>
          size="small"
          rowKey="id"
          loading={sessionsLoading}
          dataSource={sessions}
          pagination={false}
          columns={[
            {
              title: 'Appareil / contexte',
              key: 'device',
              render: (_, r) =>
                r.deviceInfo?.trim() || 'Session navigateur (refresh)',
            },
            {
              title: 'Adresse IP',
              dataIndex: 'ipAddress',
              key: 'ip',
              render: (ip: string | null) => ip ?? '—',
            },
            {
              title: 'Créée le',
              dataIndex: 'createdAt',
              key: 'createdAt',
              render: (d: string) => fmtDateTime(d),
            },
            {
              title: '',
              key: 'act',
              width: 100,
              render: (_, r) => (
                <Button
                  type="link"
                  size="small"
                  danger
                  loading={revokingId === r.id}
                  onClick={() => void onRevokeSession(r.id)}
                >
                  Révoquer
                </Button>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title={orgModalTitle}
        open={orgKind != null}
        onCancel={() => setOrgKind(null)}
        footer={null}
        width={720}
        destroyOnHidden
      >
        <div style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            onClick={openOrgCreate}
            style={{
              background: adminTheme.teal,
              borderColor: adminTheme.teal,
            }}
          >
            Ajouter
          </Button>
        </div>
        <Table<OrgTableRow>
          size="small"
          rowKey="id"
          loading={orgLoading}
          dataSource={orgRows}
          columns={orgColumns}
          pagination={false}
        />
      </Modal>

      <Modal
        title={
          orgEditorMode === 'create'
            ? 'Ajouter'
            : orgEditorKind === 'directions'
              ? 'Modifier la direction'
              : orgEditorKind === 'departments'
                ? 'Modifier le département'
                : 'Modifier le service'
        }
        open={orgEditorOpen}
        onCancel={() => setOrgEditorOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={orgEntityForm} layout="vertical">
          <Form.Item
            name="name"
            label="Nom"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Input />
          </Form.Item>
          {orgEditorKind === 'departments' ? (
            <Form.Item name="directionId" label="Direction (optionnel)">
              <Select
                allowClear
                placeholder="Aucune"
                options={directions.map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
              />
            </Form.Item>
          ) : null}
          {orgEditorKind === 'services' ? (
            <Form.Item name="departmentId" label="Département (optionnel)">
              <Select
                allowClear
                placeholder="Aucun"
                options={departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
              />
            </Form.Item>
          ) : null}
          <Space>
            <Button onClick={() => setOrgEditorOpen(false)}>Annuler</Button>
            <Button
              type="primary"
              loading={orgSaving}
              onClick={() => void submitOrgEntity()}
              style={{
                background: adminTheme.teal,
                borderColor: adminTheme.teal,
              }}
            >
              Enregistrer
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
