import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, Spin, Typography } from 'antd'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'

const TEAL = '#0F5C5E'

type LoginFormValues = {
  email: string
  password: string
}

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const navState = location.state as { from?: string } | undefined
  const from =
    typeof navState?.from === 'string' && navState.from.startsWith('/')
      ? navState.from
      : '/'

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  async function onFinish(values: LoginFormValues) {
    setError(null)
    setSubmitting(true)
    try {
      await login(values.email.trim(), values.password)
      navigate(from, { replace: true })
    } catch (e) {
      setError(getApiErrorMessage(e, 'Connexion impossible'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F4F6F6',
        padding: 24,
      }}
    >
      <Card
        style={{ width: '100%', maxWidth: 400, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img
            src="/app_icon.svg"
            alt=""
            width={72}
            height={72}
            style={{ borderRadius: 18, display: 'inline-block' }}
          />
        </div>
        <Typography.Title
          level={3}
          style={{ textAlign: 'center', color: TEAL, marginBottom: 28, marginTop: 0 }}
        >
          PaySlip Manager
        </Typography.Title>
        <Form<LoginFormValues> layout="vertical" onFinish={(v) => void onFinish(v)} requiredMark={false}>
          <Form.Item
            name="email"
            label="E-mail"
            rules={[
              { required: true, message: 'E-mail requis' },
              { type: 'email', message: 'E-mail invalide' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="admin@entreprise.com" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mot de passe"
            rules={[{ required: true, message: 'Mot de passe requis' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" />
          </Form.Item>
          {error ? (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 16 }}>
              {error}
            </Typography.Text>
          ) : null}
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              block
              size="large"
              style={{ backgroundColor: TEAL }}
            >
              Se connecter
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
