import { Alert, Button, Form, Input, message, Spin } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AuthFormField } from '../../components/AuthFormField'
import { PasswordStrengthBar } from '../../components/PasswordStrengthBar'
import { useAuth } from '../../contexts/AuthContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import * as authApi from '../../services/auth.service'
import { ADMIN_BASE } from '../../constants/adminRoutes'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './auth.css'

type RegisterFormValues = {
  lastName: string
  firstName: string
  referentJobTitle: string
  email: string
  companyName: string
  companyPhone: string
  rccm?: string
  password: string
  confirmPassword: string
}

function RegisterStepper() {
  const steps = [
    { n: 1, label: 'Créez votre compte admin', active: true },
    { n: 2, label: 'Importez vos collaborateurs', active: false },
    { n: 3, label: 'Distribuez vos bulletins', active: false },
  ]
  return (
    <div className="auth-register-stepper">
      {steps.map((s) => (
        <div key={s.n} className="auth-register-step">
          <div
            className={
              s.active
                ? 'auth-register-step__circle auth-register-step__circle--active'
                : 'auth-register-step__circle auth-register-step__circle--inactive'
            }
          >
            {s.n}
          </div>
          <span
            className={
              s.active
                ? 'auth-register-step__label'
                : 'auth-register-step__label auth-register-step__label--inactive'
            }
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function RegisterPage() {
  const { signInWithPayload, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm<RegisterFormValues>()
  const password = Form.useWatch('password', form) ?? ''
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pwdForBar = useMemo(() => String(password), [password])

  const onFinish = useCallback(
    async (values: RegisterFormValues) => {
      setError(null)
      setSubmitting(true)
      try {
        const rccm = values.rccm?.trim()
        const payload = await authApi.registerAccount({
          email: values.email.trim(),
          password: values.password,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          referentJobTitle: values.referentJobTitle.trim(),
          companyName: values.companyName.trim(),
          companyPhone: values.companyPhone.trim(),
          ...(rccm ? { rccm } : {}),
        })
        signInWithPayload(payload)
        message.success(
          `Bienvenue ${payload.user.firstName} ! Votre espace ${values.companyName.trim()} est prêt.`,
        )
        navigate(ADMIN_BASE, { replace: true })
      } catch (e) {
        setError(getApiErrorMessage(e, "Inscription impossible"))
      } finally {
        setSubmitting(false)
      }
    },
    [navigate, signInWithPayload],
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
        Créez votre espace en 2 minutes
      </h1>
      <p
        style={{
          margin: '14px 0 0',
          fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.6,
        }}
      >
        Inscrivez votre entreprise et commencez à distribuer vos bulletins de
        paie immédiatement.
      </p>
      <RegisterStepper />
    </>
  )

  return (
    <AuthLayout
      leftTabletTitle="Créez votre espace en 2 minutes"
      leftContent={leftContent}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 24,
          fontWeight: 500,
          color: '#1C2833',
        }}
      >
        Créer un compte
      </h1>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 13,
          color: '#7F8C8D',
          marginBottom: 24,
        }}
      >
        Inscrivez votre entreprise
      </p>

      <Form<RegisterFormValues>
        className="auth-form"
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(v) => void onFinish(v)}
      >
        <p
          style={{
            margin: '0 0 10px',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: '#1C2833',
            textTransform: 'uppercase',
          }}
        >
          Référent de l’entreprise
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <AuthFormField
            label="NOM"
            name="lastName"
            requiredMark
            rules={[{ required: true, message: 'Nom requis' }]}
            style={{ marginBottom: 0 }}
          >
            <Input size="large" placeholder="Koné" autoComplete="family-name" />
          </AuthFormField>
          <AuthFormField
            label="PRÉNOM"
            name="firstName"
            requiredMark
            rules={[{ required: true, message: 'Prénom requis' }]}
            style={{ marginBottom: 0 }}
          >
            <Input size="large" placeholder="Aminata" autoComplete="given-name" />
          </AuthFormField>
        </div>

        <AuthFormField
          label="FONCTION"
          name="referentJobTitle"
          requiredMark
          rules={[{ required: true, message: 'Fonction requise' }]}
          style={{ marginTop: 12, marginBottom: 0 }}
        >
          <Input
            size="large"
            placeholder="Responsable RH, Directeur administratif…"
            autoComplete="organization-title"
          />
        </AuthFormField>

        <AuthFormField
          label="E-MAIL PROFESSIONNEL"
          name="email"
          rules={[
            { required: true, message: 'E-mail requis' },
            { type: 'email', message: 'E-mail invalide' },
          ]}
          style={{ marginTop: 12, marginBottom: 0 }}
        >
          <Input
            size="large"
            placeholder="rh@societe.ci"
            autoComplete="email"
          />
        </AuthFormField>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.3fr 0.7fr',
            gap: 12,
            marginTop: 12,
          }}
        >
          <AuthFormField
            label="NOM DE L'ENTREPRISE"
            name="companyName"
            requiredMark
            rules={[{ required: true, message: "Nom de l'entreprise requis" }]}
            style={{ marginBottom: 0 }}
          >
            <Input size="large" placeholder="Ma Société SARL" />
          </AuthFormField>
          <AuthFormField
            label="RCCM"
            name="rccm"
            optional
            style={{ marginBottom: 0 }}
          >
            <Input size="large" placeholder="CI-ABJ-..." />
          </AuthFormField>
        </div>

        <AuthFormField
          label="TÉLÉPHONE"
          name="companyPhone"
          requiredMark
          rules={[
            { required: true, message: 'Téléphone requis' },
            { max: 32, message: 'Maximum 32 caractères' },
          ]}
          style={{ marginTop: 12, marginBottom: 0 }}
        >
          <Input
            size="large"
            placeholder="+225 07 00 00 00 00"
            maxLength={32}
            autoComplete="tel"
          />
        </AuthFormField>

        <AuthFormField
          label="MOT DE PASSE"
          name="password"
          requiredMark
          rules={[
            { required: true, message: 'Mot de passe requis' },
            { min: 8, message: 'Au moins 8 caractères' },
          ]}
          style={{ marginTop: 12, marginBottom: 0 }}
        >
          <Input.Password
            size="large"
            placeholder="Min. 8 caractères"
            autoComplete="new-password"
          />
        </AuthFormField>
        <div style={{ marginTop: 6 }}>
          <PasswordStrengthBar password={pwdForBar} />
        </div>

        <AuthFormField
          label="CONFIRMER LE MOT DE PASSE"
          name="confirmPassword"
          requiredMark
          dependencies={['password']}
          rules={[
            { required: true, message: 'Confirmation requise' },
            ({ getFieldValue }) => ({
              validator(_: unknown, value: string) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(
                  new Error('Les mots de passe ne correspondent pas'),
                )
              },
            }),
          ]}
          style={{ marginTop: 12, marginBottom: 0 }}
        >
          <Input.Password
            size="large"
            placeholder="Saisissez à nouveau le mot de passe"
            autoComplete="new-password"
          />
        </AuthFormField>

        {error ? (
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
          style={{ marginTop: 18 }}
        >
          Créer mon espace
        </Button>
      </Form>

      <div style={{ marginTop: 14 }}>
        <span style={{ fontSize: 13, color: '#7F8C8D' }}>
          Déjà un compte ?{' '}
        </span>
        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: 13,
            color: '#0F5C5E',
            fontWeight: 500,
          }}
        >
          Se connecter
        </button>
      </div>
    </AuthLayout>
  )
}
