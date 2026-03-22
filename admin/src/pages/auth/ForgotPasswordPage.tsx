import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { Alert, Button, Form, Input, Spin } from 'antd'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ADMIN_BASE } from '../../constants/adminRoutes'
import { AuthFormField } from '../../components/AuthFormField'
import { useAuth } from '../../contexts/AuthContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import * as authApi from '../../services/auth.service'
import { getApiErrorMessage } from '../../utils/apiErrorMessage'
import './auth.css'

type Phase = 'form' | 'sent'

type ForgotFormValues = {
  email: string
}

const RESEND_COOLDOWN_SEC = 60

const panelEase = [0.32, 0.72, 0, 1] as const

function LockIconTeal({ size }: { size: number }) {
  return (
    <LockOutlined
      style={{
        fontSize: size,
        color: 'rgba(255,255,255,0.4)',
      }}
    />
  )
}

export function ForgotPasswordPage() {
  const reduceMotion = useReducedMotion()
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm<ForgotFormValues>()
  const [phase, setPhase] = useState<Phase>('form')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resendLeft, setResendLeft] = useState(0)

  useEffect(() => {
    if (resendLeft <= 0) {
      return
    }
    const t = window.setInterval(() => {
      setResendLeft((s) => {
        if (s <= 1) {
          window.clearInterval(t)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [resendLeft])

  const submitEmail = useCallback(async (email: string) => {
    setError(null)
    setSubmitting(true)
    try {
      await authApi.forgotPassword(email.trim())
      setPhase('sent')
      setResendLeft(RESEND_COOLDOWN_SEC)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Envoi impossible'))
    } finally {
      setSubmitting(false)
    }
  }, [])

  const onFinish = useCallback(
    async (values: ForgotFormValues) => {
      await submitEmail(values.email)
    },
    [submitEmail],
  )

  const onResend = useCallback(async () => {
    if (resendLeft > 0) {
      return
    }
    const email = form.getFieldValue('email') as string | undefined
    if (!email?.trim()) {
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await authApi.forgotPassword(email.trim())
      setResendLeft(RESEND_COOLDOWN_SEC)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Renvoi impossible'))
    } finally {
      setSubmitting(false)
    }
  }, [form, resendLeft])

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
        Récupérez votre accès
      </h1>
      <p
        style={{
          margin: '12px 0 0',
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.6,
        }}
      >
        Un lien de réinitialisation vous sera envoyé par email.
      </p>
      <div
        style={{
          marginTop: 36,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: 14,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}
      >
        <LockIconTeal size={17} />
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.5,
          }}
        >
          Vous pourrez choisir un nouveau mot de passe sécurisé depuis le lien
          reçu.
        </p>
      </div>
    </>
  )

  const lockCardOrange = (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        background: '#FEF3E5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LockOutlined style={{ fontSize: 26, color: '#F28C28' }} />
    </div>
  )

  const formPanel = (
    <>
      {lockCardOrange}
          <h1
            style={{
              margin: '20px 0 0',
              fontSize: 24,
              fontWeight: 500,
              color: '#1C2833',
            }}
          >
            Mot de passe oublié ?
          </h1>
          <p
            style={{
              margin: '6px 0 28px',
              fontSize: 13,
              color: '#7F8C8D',
              lineHeight: 1.5,
            }}
          >
            Entrez votre e-mail et nous vous enverrons un lien pour réinitialiser
            votre mot de passe.
          </p>

          <Form<ForgotFormValues>
            className="auth-form"
            form={form}
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
              style={{ marginBottom: 0 }}
            >
              <Input
                size="large"
                placeholder="admin@societe.ci"
                autoComplete="email"
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
              style={{ marginTop: 24 }}
            >
              Envoyer le lien
            </Button>
          </Form>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowLeftOutlined style={{ fontSize: 13 }} />
              Retour à la connexion
            </button>
          </div>
    </>
  )

  const sentPanel = (
    <>
      {lockCardOrange}
          <h1
            style={{
              margin: '20px 0 0',
              fontSize: 24,
              fontWeight: 500,
              color: '#1C2833',
            }}
          >
            Mot de passe oublié ?
          </h1>

          <div
            style={{
              marginTop: 20,
              background: '#EAFAF1',
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <CheckCircleOutlined
              style={{ fontSize: 15, color: '#27AE60', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: '#27AE60' }}>
              Lien envoyé ! Vérifiez votre boîte mail.
            </span>
          </div>

          <p style={{ margin: '20px 0 0', fontSize: 13, color: '#7F8C8D' }}>
            Vous n&apos;avez rien reçu ?{' '}
            <button
              type="button"
              disabled={resendLeft > 0 || submitting}
              onClick={() => void onResend()}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                cursor:
                  resendLeft > 0 || submitting ? 'not-allowed' : 'pointer',
                fontSize: 13,
                color: '#F28C28',
                fontWeight: 500,
              }}
            >
              {resendLeft > 0
                ? `Renvoyer (${resendLeft}s)`
                : 'Renvoyer'}
            </button>
          </p>

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
            className="auth-btn-forgot-back"
            block
            size="large"
            style={{ marginTop: 24 }}
            onClick={() => navigate('/login')}
          >
            Retour à la connexion
          </Button>
    </>
  )

  return (
    <AuthLayout
      leftTabletTitle="Récupérez votre accès"
      leftContent={leftContent}
    >
      {reduceMotion ? (
        phase === 'form' ? (
          formPanel
        ) : (
          sentPanel
        )
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {phase === 'form' ? (
            <motion.div
              key="forgot-form"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 14 }}
              transition={{ duration: 0.26, ease: panelEase }}
            >
              {formPanel}
            </motion.div>
          ) : (
            <motion.div
              key="forgot-sent"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.26, ease: panelEase }}
            >
              {sentPanel}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </AuthLayout>
  )
}
