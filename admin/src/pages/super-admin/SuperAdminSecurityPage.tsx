import { SafetyCertificateOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, Space } from 'antd'
import { useCallback, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as authApi from '../../services/auth.service'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './superAdminPages.css'

type PasswordForm = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function SuperAdminSecurityPage() {
  const { message } = App.useApp()
  const { setSessionUser, user } = useAuth()
  const [form] = Form.useForm<PasswordForm>()
  const [submitting, setSubmitting] = useState(false)

  const onFinish = useCallback(
    async (values: PasswordForm) => {
      setSubmitting(true)
      try {
        const res = await authApi.changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        })
        message.success(res.message)
        form.resetFields()
        if (user) {
          setSessionUser({ ...user, mustChangePassword: false })
        }
      } catch (e) {
        message.error(
          getApiErrorMessage(e, 'Impossible de mettre à jour le mot de passe'),
        )
      } finally {
        setSubmitting(false)
      }
    },
    [form, message, setSessionUser, user],
  )

  return (
    <div>
      <h1 className="sa-page-title">Sécurité du compte</h1>
      <p className="sa-page-lead">
        Modifiez votre mot de passe super administrateur. Utilisez un mot de passe
        fort, unique à cette plateforme.
      </p>

      <Card
        className="sa-section-card"
        variant="outlined"
        style={{ maxWidth: 480 }}
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#F28C28' }} />
            <span>Mot de passe</span>
          </Space>
        }
      >
        <Form<PasswordForm>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(v) => void onFinish(v)}
        >
          <Form.Item
            name="currentPassword"
            label="Mot de passe actuel"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Input.Password autoComplete="current-password" size="large" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Nouveau mot de passe"
            rules={[
              { required: true, message: 'Requis' },
              { min: 8, message: 'Au moins 8 caractères' },
            ]}
          >
            <Input.Password autoComplete="new-password" size="large" />
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
            <Input.Password autoComplete="new-password" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} size="large">
              Enregistrer le nouveau mot de passe
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
