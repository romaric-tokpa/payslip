import { CheckOutlined } from '@ant-design/icons'
import { Alert, App, Button, Form, Input, Spin, Tag } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AuthFormField } from '../../components/AuthFormField'
import { ADMIN_BASE, SUPER_ADMIN_BASE } from '../../constants/adminRoutes'
import { useAuth } from '../../contexts/AuthContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import * as authApi from '../../services/auth.service'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'

import './auth.css'
import './password-required.css'

function SecurityPoint({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="auth-login-argument">
      <div className="auth-login-argument__icon" aria-hidden>
        <CheckOutlined style={{ fontSize: 11, color: '#F28C28' }} />
      </div>
      <div className="auth-login-argument__body">
        <div className="auth-login-argument__title">{title}</div>
        <div className="auth-login-argument__desc">{description}</div>
      </div>
    </div>
  )
}

function userInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  const a = firstName?.trim()?.[0] ?? ''
  const b = lastName?.trim()?.[0] ?? ''
  const p = `${a}${b}`.toUpperCase()
  if (p) {
    return p
  }
  const e = email?.trim()?.[0]
  return e != null ? e.toUpperCase() : '?'
}

function computePasswordStrength(pw: string): { level: number; label: string } {
  if (!pw) {
    return { level: 0, label: '' }
  }
  if (pw.length < 8) {
    return { level: 1, label: 'Minimum 8 caractères' }
  }
  const hasNum = /\d/.test(pw)
  const hasSpecial = /[^a-zA-ZÀ-ÿ0-9]/.test(pw)
  const mixedCase = /[a-z]/.test(pw) && /[A-Z]/.test(pw)
  let score = 2
  if (hasNum) {
    score += 1
  }
  if (hasSpecial || mixedCase) {
    score += 1
  }
  if (pw.length >= 12) {
    score += 1
  }
  const level = Math.min(score, 4)
  if (level === 2) {
    return { level, label: 'Niveau basique — ajoutez chiffres ou symboles' }
  }
  if (level === 3) {
    return { level, label: 'Bon niveau de sécurité' }
  }
  return { level: 4, label: 'Excellent — mot de passe robuste' }
}

function StrengthMeter({ password }: { password: string }) {
  const { level, label } = useMemo(
    () => computePasswordStrength(password),
    [password],
  )

  return (
    <div className="auth-password-strength">
      <div className="auth-password-strength__label">
        <span>Robustesse</span>
        {label ? <strong>{label}</strong> : null}
      </div>
      <div className="auth-password-strength__bar" aria-hidden>
        {[1, 2, 3, 4].map((i) => {
          const active = level > 0 && i <= level
          const tone =
            active && level > 0
              ? ` auth-password-strength__seg--${level}`
              : ''
          return (
            <div
              key={i}
              className={`auth-password-strength__seg${tone}`.trim()}
            />
          )
        })}
      </div>
      <p className="auth-password-hint">
        Combinez lettres, chiffres et symboles ; évitez les mots du dictionnaire.
      </p>
    </div>
  )
}

export function PasswordRequiredPage() {
  const { message } = App.useApp()
  const { user, isLoading, isAuthenticated, setSessionUser, logout } =
    useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<{
    currentPassword: string
    newPassword: string
    confirm: string
  }>()

  const newPasswordValue = Form.useWatch('newPassword', form) ?? ''

  const onFinish = useCallback(
    async (values: {
      currentPassword: string
      newPassword: string
      confirm: string
    }) => {
      setSubmitting(true)
      try {
        await authApi.changePassword({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        })
        if (user) {
          const next = { ...user, mustChangePassword: false }
          setSessionUser(next)
        }
        message.success('Mot de passe mis à jour — bienvenue !')
        if (user?.role === 'SUPER_ADMIN') {
          navigate(SUPER_ADMIN_BASE, { replace: true })
        } else {
          navigate(ADMIN_BASE, { replace: true })
        }
      } catch (e) {
        message.error(
          getApiErrorMessage(e, 'Échec du changement de mot de passe'),
        )
      } finally {
        setSubmitting(false)
      }
    },
    [message, navigate, setSessionUser, user],
  )

  const onLogout = useCallback(async () => {
    await logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const leftContent = useMemo(
    () => (
      <div>
        <h2 className="auth-login-left__title">Sécurisez votre compte</h2>
        <p className="auth-login-left__lead">
          Votre organisation impose un mot de passe personnel avant la première
          utilisation de PaySlip Manager. Cette étape ne prend qu’une minute.
        </p>
        <div className="auth-login-left__args">
          <SecurityPoint
            title="Protection des données RH"
            description="Un mot de passe unique limite les accès non autorisés aux bulletins et aux dossiers collaborateurs."
          />
          <SecurityPoint
            title="Session chiffrée"
            description="Après validation, vous accédez au tableau de bord avec une session JWT renouvelée automatiquement."
          />
          <SecurityPoint
            title="Bonnes pratiques"
            description="Ne réutilisez pas un mot de passe déjà employé sur d’autres services professionnels."
          />
        </div>
      </div>
    ),
    [],
  )

  if (isLoading) {
    return (
      <div className="auth-page-loading">
        <div className="auth-page-loading__inner">
          <Spin size="large" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!user.mustChangePassword) {
    return (
      <Navigate
        to={user.role === 'SUPER_ADMIN' ? SUPER_ADMIN_BASE : ADMIN_BASE}
        replace
      />
    )
  }

  const isSuper = user.role === 'SUPER_ADMIN'

  return (
    <AuthLayout
      leftTabletTitle="Nouveau mot de passe requis"
      leftContent={leftContent}
    >
      <div className="auth-login-panel auth-password-card">
        <header className="auth-login-panel__head">
          <div className="auth-password-eyebrow">
            <span className="auth-password-eyebrow__dot" aria-hidden />
            Sécurité
          </div>
          <h1 className="auth-login-panel__title">Définir votre mot de passe</h1>
          <p className="auth-login-panel__subtitle">
            Remplacez le mot de passe temporaire par un mot de passe personnel
            robuste. Vous pourrez le modifier plus tard dans les paramètres.
          </p>
        </header>

        <div
          className="auth-password-user"
          role="group"
          aria-label="Compte concerné"
        >
          <div
            className={`auth-password-user__avatar${isSuper ? ' auth-password-user__avatar--super' : ''}`}
            aria-hidden
          >
            {userInitials(user.firstName, user.lastName, user.email)}
          </div>
          <div className="auth-password-user__meta">
            <div className="auth-password-user__name">
              {user.firstName} {user.lastName}
            </div>
            <div className="auth-password-user__email">{user.email}</div>
          </div>
          {isSuper ? (
            <Tag color="#F28C28" className="auth-password-user__tag">
              Super Admin
            </Tag>
          ) : null}
        </div>

        <Alert
          type="info"
          showIcon
          className="auth-password-alert auth-login-alert"
          title="Exigences"
          description="Au moins 8 caractères. Privilégiez une phrase courte mémorable ou un gestionnaire de mots de passe."
        />

        <Form
          form={form}
          layout="vertical"
          className="auth-form auth-login-form auth-password-form"
          requiredMark={false}
          onFinish={(v) => void onFinish(v)}
        >
          <AuthFormField
            label="Mot de passe actuel"
            name="currentPassword"
            rules={[{ required: true, message: 'Requis' }]}
          >
            <Input.Password
              size="large"
              autoComplete="current-password"
              placeholder="Celui fourni par votre administrateur"
              className="auth-login-input"
            />
          </AuthFormField>

          <AuthFormField
            label="Nouveau mot de passe"
            name="newPassword"
            rules={[
              { required: true, message: 'Requis' },
              { min: 8, message: 'Au moins 8 caractères' },
            ]}
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              placeholder="Choisissez un mot de passe fort"
              className="auth-login-input"
            />
          </AuthFormField>

          <StrengthMeter password={newPasswordValue} />

          <AuthFormField
            label="Confirmer le mot de passe"
            name="confirm"
            dependencies={['newPassword']}
            style={{ marginTop: 18 }}
            rules={[
              { required: true, message: 'Requis' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(
                    new Error('Les deux saisies ne correspondent pas'),
                  )
                },
              }),
            ]}
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              placeholder="Retapez le nouveau mot de passe"
              className="auth-login-input"
            />
          </AuthFormField>

          <div className="auth-password-actions">
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={submitting}
              className="auth-password-submit auth-login-submit"
            >
              Enregistrer et accéder à la plateforme
            </Button>
          </div>
        </Form>

        <div className="auth-password-logout">
          <button
            type="button"
            className="auth-password-logout__btn"
            onClick={() => void onLogout()}
          >
            Ce n’est pas vous ? Se déconnecter
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}
