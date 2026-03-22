import { SafetyOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Spin, message } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ADMIN_BASE } from '../../constants/adminRoutes'
import { AuthFormField } from '../../components/AuthFormField'
import { PasswordChecklist } from '../../components/PasswordChecklist'
import {
  getPasswordStrengthScore,
  PasswordStrengthBar,
} from '../../components/PasswordStrengthBar'
import { useAuth } from '../../contexts/AuthContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import * as authApi from '../../services/auth.service'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './auth.css'

type ResetFormValues = {
  password: string
  confirm: string
}

export function ResetPasswordPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [resetToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }
    const t = new URLSearchParams(window.location.search).get('token')
    return t != null && t !== '' ? t : null
  })
  const [form] = Form.useForm<ResetFormValues>()
  const password = Form.useWatch('password', form) ?? ''
  const confirm = Form.useWatch('confirm', form) ?? ''
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const score = useMemo(
    () => getPasswordStrengthScore(String(password)),
    [password],
  )
  const pwd = String(password)
  const conf = String(confirm)
  const mismatch = confirmTouched && conf.length > 0 && pwd !== conf
  const canSubmit =
    Boolean(resetToken) &&
    score >= 2 &&
    pwd.length >= 8 &&
    conf.length > 0 &&
    pwd === conf

  const onFinish = useCallback(
    async (values: ResetFormValues) => {
      if (!resetToken) {
        return
      }
      setError(null)
      setSubmitting(true)
      try {
        await authApi.resetPasswordWithToken({
          resetToken,
          newPassword: values.password,
        })
        void message.success('Mot de passe modifié !')
        navigate('/login', { replace: true })
      } catch (e) {
        const msg = getApiErrorMessage(e, 'Réinitialisation impossible')
        if (/expir|invalid|invalide|expired/i.test(msg)) {
          setTokenError(true)
        }
        setError(msg)
      } finally {
        setSubmitting(false)
      }
    },
    [navigate, resetToken],
  )

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
    return <Navigate to={ADMIN_BASE} replace />
  }

  const leftContent = (
    <>
      <h1
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 500,
          color: '#fff',
          lineHeight: 1.25,
        }}
      >
        Choisissez un nouveau mot de passe
      </h1>
      <p
        style={{
          margin: '12px 0 0',
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.6,
        }}
      >
        Votre ancien mot de passe ne sera plus utilisable.
      </p>
    </>
  )

  if (resetToken == null) {
    return (
      <AuthLayout
        leftTabletTitle="Nouveau mot de passe"
        leftContent={leftContent}
      >
        <Alert
          type="error"
          showIcon
          message="Lien invalide"
          description="Ce lien est incomplet ou a expiré. Demandez un nouveau lien."
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" block size="large" onClick={() => navigate('/forgot-password')}>
          Demander un nouveau lien
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      leftTabletTitle="Choisissez un nouveau mot de passe"
      leftContent={leftContent}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: '#E8F5F5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SafetyOutlined style={{ fontSize: 26, color: '#0F5C5E' }} />
      </div>
      <h1
        style={{
          margin: '20px 0 0',
          fontSize: 24,
          fontWeight: 500,
          color: '#1C2833',
        }}
      >
        Nouveau mot de passe
      </h1>
      <p
        style={{
          margin: '6px 0 24px',
          fontSize: 13,
          color: '#7F8C8D',
        }}
      >
        Choisissez un mot de passe sécurisé.
      </p>

      {tokenError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Ce lien a expiré. Demandez un nouveau lien."
          action={
            <Button size="small" onClick={() => navigate('/forgot-password')}>
              Mot de passe oublié
            </Button>
          }
        />
      ) : null}

      <Form<ResetFormValues>
        className="auth-form"
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(v) => void onFinish(v)}
      >
        <AuthFormField
          label="NOUVEAU MOT DE PASSE"
          name="password"
          rules={[
            { required: true, message: 'Mot de passe requis' },
            { min: 8, message: 'Au moins 8 caractères' },
          ]}
          style={{ marginBottom: 0 }}
        >
          <Input.Password
            size="large"
            placeholder="Min. 8 caractères"
            autoComplete="new-password"
          />
        </AuthFormField>

        <AuthFormField
          label="CONFIRMER"
          name="confirm"
          rules={[{ required: true, message: 'Confirmation requise' }]}
          style={{ marginTop: 14, marginBottom: 0 }}
        >
          <Input.Password
            size="large"
            placeholder="Retapez le mot de passe"
            autoComplete="new-password"
            onBlur={() => setConfirmTouched(true)}
          />
        </AuthFormField>

        {mismatch ? (
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#E74C3C' }}>
            Les mots de passe ne correspondent pas
          </p>
        ) : null}

        <div style={{ marginTop: 8 }}>
          <PasswordStrengthBar password={String(password)} />
        </div>
        <div style={{ marginTop: 14 }}>
          <PasswordChecklist password={String(password)} />
        </div>

        {error && !tokenError ? (
          <Alert
            type="error"
            closable
            style={{ marginTop: 12 }}
            message={error}
            onClose={() => setError(null)}
          />
        ) : null}

        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={submitting}
          disabled={!canSubmit}
          style={{ marginTop: 20 }}
        >
          Confirmer le mot de passe
        </Button>
      </Form>
    </AuthLayout>
  )
}
