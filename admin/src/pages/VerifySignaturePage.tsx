import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { Button, Card, Input, Typography } from 'antd'
import { useState } from 'react'
import appIconUrl from '../assets/app_icon.svg?url'
import * as payslipsApi from '../services/payslips.service'
import { getApiErrorMessage } from '../utils/apiErrorMessage'
import './verify-signature.css'

export function VerifySignaturePage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<
    Awaited<ReturnType<typeof payslipsApi.verifyPayslipSignaturePublic>> | null
  >(null)

  async function onVerify() {
    const c = code.replace(/\s/g, '').toUpperCase()
    if (c.length < 12) {
      setError('Saisissez le code de vérification (12 caractères).')
      setResult(null)
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await payslipsApi.verifyPayslipSignaturePublic(c)
      setResult(data)
      if (!data.valid) {
        setError('Code de vérification non trouvé.')
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Vérification impossible'))
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="verify-page">
      <header className="verify-page__header">
        <img
          src={appIconUrl}
          alt="PaySlip Manager"
          width={56}
          height={56}
          className="verify-page__logo"
        />
        <Typography.Title level={2} className="verify-page__title">
          Vérifier un accusé de réception
        </Typography.Title>
        <p className="verify-page__lead">
          Saisissez le code à 12 caractères fourni au collaborateur après signature
          du bulletin de paie.
        </p>
      </header>

      <Card className="verify-page__card">
        <label className="verify-page__label" htmlFor="verify-code-input">
          Code de vérification
        </label>
        <Input
          id="verify-code-input"
          size="large"
          placeholder="Ex. A1B2C3D4E5F6"
          maxLength={14}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^0-9A-F]/gi, ''))
          }
          onPressEnter={() => void onVerify()}
          className="verify-page__input"
        />
        <Button
          type="primary"
          size="large"
          loading={loading}
          onClick={() => void onVerify()}
          className="verify-page__btn employees-btn-primary-teal"
        >
          Vérifier
        </Button>

        {error != null && !result?.valid ? (
          <div className="verify-page__msg verify-page__msg--err" role="alert">
            <CloseCircleOutlined /> {error}
          </div>
        ) : null}

        {result?.valid === true && result.details ? (
          <Card className="verify-page__ok" bordered={false}>
            <div className="verify-page__ok-head">
              <CheckCircleOutlined className="verify-page__ok-icon" />
              <TagTeal>Signature valide</TagTeal>
            </div>
            <dl className="verify-page__dl">
              <dt>Collaborateur</dt>
              <dd>{result.details.employeeName}</dd>
              <dt>Matricule</dt>
              <dd>{result.details.employeeId || '—'}</dd>
              <dt>Entreprise</dt>
              <dd>{result.details.companyName}</dd>
              <dt>Période</dt>
              <dd>{result.details.period}</dd>
              <dt>Date de signature</dt>
              <dd>
                {new Date(result.details.signedAt).toLocaleString('fr-FR', {
                  timeZone: 'Africa/Abidjan',
                })}
              </dd>
              <dt>Empreinte SHA-256</dt>
              <dd className="verify-page__hash">{result.details.fileHash}</dd>
            </dl>
          </Card>
        ) : null}
      </Card>
    </div>
  )
}

function TagTeal({ children }: { children: string }) {
  return <span className="verify-page__tag">{children}</span>
}
