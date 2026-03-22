import { CheckOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Spin } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { AuthFormField } from '../../components/AuthFormField'
import { useAuth } from '../../contexts/AuthContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import { ADMIN_BASE } from '../../constants/adminRoutes'
import { safeReturnUrl } from './authReturnUrl'

import './auth.css'

function normalizeAfterLogin(path: string): string {
  return path === '/' ? ADMIN_BASE : path
}

const LOCKOUT_SECONDS = 45
const MAX_ATTEMPTS = 3

type LoginFormValues = {
  email: string
  password: string
}

function LoginArgument({
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

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)
  const failedAttempts = useRef(0)

  const navState = location.state as { from?: string } | undefined
  const fromState =
    typeof navState?.from === 'string' ? navState.from : undefined
  const returnTarget = normalizeAfterLogin(
    safeReturnUrl(searchParams.get('returnUrl')) ??
      safeReturnUrl(fromState ?? null) ??
      ADMIN_BASE,
  )

  useEffect(() => {
    if (lockoutRemaining <= 0) {
      return
    }
    const t = window.setInterval(() => {
      setLockoutRemaining((s) => {
        if (s <= 1) {
          window.clearInterval(t)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [lockoutRemaining])

  const onFinish = useCallback(
    async (values: LoginFormValues) => {
      if (lockoutRemaining > 0) {
        return
      }
      setError(null)
      setSubmitting(true)
      try {
        await login(values.email.trim(), values.password)
        failedAttempts.current = 0
        navigate(returnTarget, { replace: true })
      } catch (e) {
        failedAttempts.current += 1
        if (failedAttempts.current >= MAX_ATTEMPTS) {
          setLockoutRemaining(LOCKOUT_SECONDS)
          failedAttempts.current = 0
          setError(null)
        } else {
          setError(getApiErrorMessage(e, 'Connexion impossible'))
        }
      } finally {
        setSubmitting(false)
      }
    },
    [login, lockoutRemaining, navigate, returnTarget],
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

  if (isAuthenticated) {
    return <Navigate to={returnTarget} replace />
  }

  const leftContent = (
    <div className="auth-login-left">
      <h1 className="auth-login-left__title">Simplifiez la distribution de vos bulletins</h1>
      <p className="auth-login-left__lead">
        Uploadez, distribuez et suivez la consultation des bulletins de paie de tous vos collaborateurs en quelques
        clics.
      </p>
      <div className="auth-login-left__args">
        <LoginArgument
          title="Import intelligent"
          description="Détection automatique des collaborateurs par extraction PDF"
        />
        <LoginArgument
          title="Suivi en temps réel"
          description="Taux de consultation, alertes CDD, audit complet"
        />
        <LoginArgument
          title="App mobile collaborateur"
          description="Chaque employé consulte ses bulletins depuis son téléphone"
        />
      </div>
    </div>
  )

  return (
    <AuthLayout
      leftTabletTitle="Simplifiez la distribution de vos bulletins"
      leftContent={leftContent}
    >
      <div className="auth-login-panel">
        <header className="auth-login-panel__head">
          <h1 className="auth-login-panel__title">Connexion</h1>
          <p className="auth-login-panel__subtitle">Accédez à votre espace d&apos;administration</p>
        </header>

        <Form<LoginFormValues>
          className="auth-form auth-login-form"
          layout="vertical"
          requiredMark={false}
          onFinish={(v) => void onFinish(v)}
        >
          <AuthFormField
            label="E-MAIL"
            name="email"
            rules={[
              { required: true, message: 'E-mail requis' },
              { type: 'email', message: 'E-mail invalide' },
            ]}
          >
            <Input
              size="large"
              placeholder="admin@societe.ci"
              autoComplete="email"
              className="auth-login-input"
            />
          </AuthFormField>

          <AuthFormField
            label="MOT DE PASSE"
            name="password"
            rules={[{ required: true, message: 'Mot de passe requis' }]}
            style={{ marginTop: 18 }}
          >
            <Input.Password
              size="large"
              placeholder="Votre mot de passe"
              autoComplete="current-password"
              className="auth-login-input"
            />
          </AuthFormField>

          <div className="auth-login-forgot-wrap">
            <button type="button" className="auth-login-link" onClick={() => navigate('/forgot-password')}>
              Mot de passe oublié ?
            </button>
          </div>

          {lockoutRemaining > 0 ? (
            <Alert
              type="warning"
              showIcon
              className="auth-login-alert"
              message={`Trop de tentatives. Réessayez dans ${lockoutRemaining} seconde${lockoutRemaining > 1 ? 's' : ''}.`}
            />
          ) : null}

          {error ? (
            <Alert
              type="error"
              closable
              className="auth-login-alert"
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
            disabled={lockoutRemaining > 0}
            className="auth-login-submit"
          >
            Se connecter
          </Button>
        </Form>

        <div className="auth-divider-or auth-login-divider">
          <div className="auth-divider-or__line" />
          <span className="auth-divider-or__text">ou</span>
          <div className="auth-divider-or__line" />
        </div>

        <p className="auth-login-register">
          <span className="auth-login-register__muted">Pas encore de compte ?</span>{' '}
          <button type="button" className="auth-login-register__btn" onClick={() => navigate('/register')}>
            Créer un compte
          </button>
        </p>
      </div>
    </AuthLayout>
  )
}
