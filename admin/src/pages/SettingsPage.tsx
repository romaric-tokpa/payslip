import { LogoutOutlined, SaveOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as authApi from '../services/auth.service'
import * as settingsApi from '../services/settings.service'
import type { MeSettingsResponse } from '../types/settings'
import { getApiErrorMessage } from '../utils/apiErrorMessage'
import './employees/employees.css'

const { Title, Text, Paragraph } = Typography

const TEAL = '#0F5C5E'

const ROLE_LABELS: Record<string, string> = {
  RH_ADMIN: 'Administrateur RH',
  SUPER_ADMIN: 'Super administrateur',
  EMPLOYEE: 'Collaborateur',
}

export function SettingsPage() {
  const { message } = App.useApp()
  const { user: sessionUser, setSessionUser, logout } = useAuth()
  const [profileForm] = Form.useForm()
  const [companyForm] = Form.useForm()
  const [passwordForm] = Form.useForm()

  const [me, setMe] = useState<MeSettingsResponse | null>(null)
  const [loadingMe, setLoadingMe] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingCompany, setSavingCompany] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

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

  useEffect(() => {
    if (!me) return
    profileForm.setFieldsValue({
      firstName: me.user.firstName,
      lastName: me.user.lastName,
      email: me.user.email,
      department: me.user.department ?? '',
      position: me.user.position ?? '',
    })
    if (me.company) {
      companyForm.setFieldsValue({
        companyName: me.company.name,
        companyRccm: me.company.rccm ?? '',
        companyAddress: me.company.address ?? '',
      })
    }
  }, [me, profileForm, companyForm])

  useEffect(() => {
    void loadMe()
  }, [loadMe])

  async function onSaveProfile() {
    try {
      const values = await profileForm.validateFields()
      setSavingProfile(true)
      const payload = {
        firstName: values.firstName?.trim(),
        lastName: values.lastName?.trim(),
        email: values.email?.trim(),
        department: values.department?.trim() || undefined,
        position: values.position?.trim() || undefined,
      }
      const data = await settingsApi.updateMe(payload)
      setMe(data)
      setSessionUser(settingsApi.meUserToSessionUser(data.user))
      message.success('Profil enregistré')
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Une erreur est survenue'))
    } finally {
      setSavingProfile(false)
    }
  }

  async function onSaveCompany() {
    if (!me?.company) return
    try {
      const values = await companyForm.validateFields()
      setSavingCompany(true)
      const data = await settingsApi.updateMyCompany({
        name: values.companyName?.trim(),
        rccm: values.companyRccm?.trim() ?? '',
        address: values.companyAddress?.trim() ?? '',
      })
      setMe(data)
      if (data.company) {
        companyForm.setFieldsValue({
          companyName: data.company.name,
          companyRccm: data.company.rccm ?? '',
          companyAddress: data.company.address ?? '',
        })
      }
      message.success('Informations légales enregistrées')
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Une erreur est survenue'))
    } finally {
      setSavingCompany(false)
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
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        return
      }
      message.error(getApiErrorMessage(e, 'Une erreur est survenue'))
    } finally {
      setChangingPassword(false)
    }
  }

  const displayUser = me?.user
  const roleLabel =
    displayUser?.role != null
      ? ROLE_LABELS[displayUser.role] ?? displayUser.role
      : sessionUser?.role != null
        ? ROLE_LABELS[sessionUser.role] ?? sessionUser.role
        : '—'

  return (
    <div>
      <div className="employees-page-header">
        <div>
          <Title level={3} style={{ margin: 0, color: TEAL }}>
            Paramètres
          </Title>
          <Text type="secondary">
            Compte connecté, entreprise liée et sécurité du mot de passe.
          </Text>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card
            title="Mon profil"
            loading={loadingMe}
            styles={{ header: { borderBottom: `1px solid ${TEAL}33` } }}
          >
            {displayUser ? (
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">Rôle sur la plateforme</Text>
                  <div>
                    <Tag color={TEAL}>{roleLabel}</Tag>
                    {displayUser.isActive ? (
                      <Tag color="success">Compte actif</Tag>
                    ) : (
                      <Tag>Compte inactif</Tag>
                    )}
                  </div>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <Form
                  form={profileForm}
                  layout="vertical"
                  requiredMark="optional"
                  onFinish={() => void onSaveProfile()}
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="firstName"
                        label="Prénom"
                        rules={[{ required: true, message: 'Prénom requis' }]}
                      >
                        <Input autoComplete="given-name" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="lastName"
                        label="Nom"
                        rules={[{ required: true, message: 'Nom requis' }]}
                      >
                        <Input autoComplete="family-name" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    name="email"
                    label="E-mail de connexion"
                    rules={[
                      { required: true, message: 'E-mail requis' },
                      { type: 'email', message: 'E-mail invalide' },
                    ]}
                  >
                    <Input autoComplete="email" />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="department" label="Département">
                        <Input placeholder="Optionnel" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="position" label="Poste">
                        <Input placeholder="Optionnel" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SaveOutlined />}
                      loading={savingProfile}
                      style={{ background: TEAL, borderColor: TEAL }}
                    >
                      Enregistrer le profil
                    </Button>
                  </Form.Item>
                </Form>
              </Space>
            ) : (
              !loadingMe && (
                <Paragraph type="secondary">
                  Impossible de charger le profil. Vérifiez la connexion à l’API.
                </Paragraph>
              )
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Card
              title="Mon entreprise"
              loading={loadingMe}
              styles={{ header: { borderBottom: `1px solid ${TEAL}33` } }}
            >
              {me?.company ? (
                <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    Ces données figurent sur les documents et la traçabilité. Les
                    modifications sont enregistrées dans le journal d’audit.
                  </Paragraph>
                  <Form
                    form={companyForm}
                    layout="vertical"
                    requiredMark="optional"
                    onFinish={() => void onSaveCompany()}
                  >
                    <Form.Item
                      name="companyName"
                      label="Raison sociale"
                      rules={[{ required: true, message: 'Raison sociale requise' }]}
                    >
                      <Input placeholder="Nom légal de l’entreprise" />
                    </Form.Item>
                    <Form.Item
                      name="companyRccm"
                      label="RCCM"
                      rules={[{ max: 64, message: '64 caractères maximum' }]}
                    >
                      <Input placeholder="Ex. CI-ABJ-2018-B-12345" allowClear />
                    </Form.Item>
                    <Form.Item
                      name="companyAddress"
                      label="Adresse"
                      rules={[{ max: 500, message: '500 caractères maximum' }]}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder="Siège social ou adresse de correspondance"
                        allowClear
                      />
                    </Form.Item>
                    <Form.Item>
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        loading={savingCompany}
                        style={{ background: TEAL, borderColor: TEAL }}
                      >
                        Enregistrer les informations légales
                      </Button>
                    </Form.Item>
                  </Form>
                </Space>
              ) : (
                <Alert
                  type="info"
                  showIcon
                  title="Compte sans entreprise rattachée"
                  description={
                    sessionUser?.role === 'SUPER_ADMIN'
                      ? 'Votre compte super administrateur n’est pas lié à une société : le périmètre couvre toute la plateforme.'
                      : 'Aucune fiche entreprise n’est associée à ce compte. Contactez le support si c’est anormal.'
                  }
                />
              )}
            </Card>

            <Card
              title="Sécurité"
              styles={{ header: { borderBottom: `1px solid ${TEAL}33` } }}
            >
              <Paragraph type="secondary" style={{ marginTop: 0 }}>
                Choisissez un mot de passe robuste (au moins 8 caractères). Le
                changement est journalisé dans les logs d’audit.
              </Paragraph>
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={() => void onChangePassword()}
              >
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
                  label="Confirmer le nouveau mot de passe"
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
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={changingPassword}
                    style={{ background: TEAL, borderColor: TEAL }}
                  >
                    Mettre à jour le mot de passe
                  </Button>
                </Form.Item>
              </Form>
            </Card>

            <Card
              title="Session"
              styles={{ header: { borderBottom: `1px solid ${TEAL}33` } }}
            >
              <Paragraph type="secondary" style={{ marginTop: 0 }}>
                Déconnexion de cet appareil : les jetons de rafraîchissement
                actuels seront révoqués côté serveur.
              </Paragraph>
              <Button
                danger
                icon={<LogoutOutlined />}
                onClick={() => void logout()}
              >
                Se déconnecter
              </Button>
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  )
}
