import {
  AudioMutedOutlined,
  MailOutlined,
  PrinterOutlined,
  SendOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Checkbox,
  Collapse,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ActivatedCredential,
  BulkActivateDto,
  BulkActivateResponse,
} from '../../../types/employees'
import * as employeesApi from '../../../services/employees.service'
import { getApiErrorMessage } from '../../../utils/apiErrorMessage'
import './activation-step.css'

const { TextArea } = Input
const { Text, Paragraph } = Typography

const HOUR_OPTIONS: { value: number; label: string }[] = [
  { value: 24, label: '24 heures' },
  { value: 48, label: '48 heures' },
  { value: 72, label: '72 heures (recommandé)' },
  { value: 168, label: '7 jours' },
  { value: 720, label: '30 jours' },
]

const PREVIEW = {
  firstName: 'Awa',
  lastName: 'Diop',
  email: 'awa.diallo@entreprise.ci',
  employeeId: 'EMP002',
  tempPassword: 'Awa-EMP002-2026!',
  companyName: 'Votre entreprise',
  expiresInHours: 72,
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildEmailPreviewHtml(customMessage?: string): string {
  const cm = customMessage?.trim()
    ? `<p style="font-size: 13px; color: #7F8C8D; font-style: italic; border-left: 3px solid #E8E8E8; padding-left: 12px; margin: 16px 0;">${escapeHtml(customMessage.trim())}</p>`
    : ''
  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0F5C5E; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">PaySlip Manager</h1>
          <p style="color: rgba(255,255,255,0.6); margin: 6px 0 0; font-size: 14px;">Vos bulletins, en un clic.</p>
        </div>
        <div style="background: #F8F9FA; border: 1px solid #E8E8E8; border-radius: 0 0 12px 12px; padding: 24px;">
          <p style="font-size: 16px; color: #1C2833;">Bonjour <strong>${escapeHtml(PREVIEW.firstName)} ${escapeHtml(PREVIEW.lastName)}</strong>,</p>
          <p style="font-size: 14px; color: #7F8C8D; line-height: 1.6;">
            Votre espace personnel chez <strong>${escapeHtml(PREVIEW.companyName)}</strong> est prêt.
            Vous pouvez désormais consulter vos bulletins de paie depuis votre téléphone.
          </p>
          <div style="background: white; border: 1px solid #E8E8E8; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="font-size: 12px; color: #7F8C8D; margin: 0 0 4px;">VOS IDENTIFIANTS</p>
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #7F8C8D; padding: 6px 0;">Matricule</td>
                <td style="text-align: right; font-weight: bold; color: #1C2833;">${escapeHtml(PREVIEW.employeeId)}</td>
              </tr>
              <tr>
                <td style="color: #7F8C8D; padding: 6px 0;">Email</td>
                <td style="text-align: right; color: #0F5C5E;">${escapeHtml(PREVIEW.email)}</td>
              </tr>
              <tr>
                <td style="color: #7F8C8D; padding: 6px 0;">Mot de passe</td>
                <td style="text-align: right; font-weight: bold; color: #F28C28; font-family: monospace; font-size: 16px;">${escapeHtml(PREVIEW.tempPassword)}</td>
              </tr>
            </table>
          </div>
          <div style="background: #FEF3E5; border-radius: 8px; padding: 12px; margin: 16px 0;">
            <p style="font-size: 12px; color: #854F0B; margin: 0;">
              ⚠️ Ce mot de passe est temporaire et expire dans <strong>${PREVIEW.expiresInHours} heures</strong>.
              Vous devrez le changer lors de votre première connexion.
            </p>
          </div>
          ${cm}
          <div style="text-align: center; margin-top: 24px;">
            <span style="background: #F28C28; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
              Télécharger l'application
            </span>
          </div>
          <p style="font-size: 11px; color: #BDC3C7; text-align: center; margin-top: 20px;">
            ${escapeHtml(PREVIEW.companyName)} utilise PaySlip Manager pour la distribution sécurisée de vos bulletins de paie.
          </p>
        </div>
      </div>
    `
}

function csvEscapeCell(s: string): string {
  const t = String(s ?? '').replace(/"/g, '""')
  return `"${t}"`
}

export function exportActivatedCredentialsCsv(
  credentials: ActivatedCredential[],
): void {
  const rows = credentials.filter((c) => c.status === 'activated')
  const lines = [
    'Matricule,Nom,Prénom,Email,Mot de passe temporaire,Département,Service',
    ...rows.map(
      (c) =>
        [
          csvEscapeCell(c.employeeId),
          csvEscapeCell(c.lastName),
          csvEscapeCell(c.firstName),
          csvEscapeCell(c.email),
          csvEscapeCell(c.tempPassword),
          csvEscapeCell(c.department ?? ''),
          csvEscapeCell(c.service ?? ''),
        ].join(','),
    ),
  ]
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `identifiants_activation_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export type ActivationStepProps = {
  userIds: string[]
  /** Carte avec en-tête (flux import) ; sinon contenu seul (modal) */
  variant?: 'card' | 'plain'
  onFinished?: () => void
}

export function ActivationStep({
  userIds,
  variant = 'card',
  onFinished,
}: ActivationStepProps) {
  const { message } = App.useApp()
  const uniqueIds = useMemo(
    () => [...new Set(userIds.filter(Boolean))],
    [userIds],
  )

  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null)
  const [autoActivate, setAutoActivate] = useState(true)
  const [hours, setHours] = useState(72)
  const [sendMethod, setSendMethod] = useState<'email' | 'pdf' | 'none'>('pdf')
  const [whatsapp, setWhatsapp] = useState(true)
  const [customMessage, setCustomMessage] = useState('')
  const [phase, setPhase] = useState<'form' | 'running' | 'done'>('form')
  const [result, setResult] = useState<BulkActivateResponse | null>(null)
  const [lastSendMethod, setLastSendMethod] = useState<
    'email' | 'pdf' | 'none' | null
  >(null)

  useEffect(() => {
    let cancelled = false
    void employeesApi
      .getActivationMessagingConfig()
      .then((cfg) => {
        if (!cancelled) {
          setSmtpConfigured(cfg.smtpConfigured)
          setSendMethod(cfg.smtpConfigured ? 'email' : 'pdf')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSmtpConfigured(false)
          setSendMethod('pdf')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setPhase('form')
    setResult(null)
    setLastSendMethod(null)
  }, [uniqueIds.join('|')])

  const effectiveSendMethod = useMemo(() => {
    if (sendMethod === 'email' && smtpConfigured === false) {
      return 'none'
    }
    return sendMethod
  }, [sendMethod, smtpConfigured])

  const buildPayload = useCallback(
    (ids: string[], send: 'email' | 'pdf' | 'none'): BulkActivateDto => {
      return {
        userIds: ids,
        sendMethod: send,
        generateWhatsappLinks: whatsapp,
        customMessage: customMessage.trim() || undefined,
        tempPasswordExpiresInHours: hours,
      }
    },
    [whatsapp, customMessage, hours],
  )

  const runBulkActivate = useCallback(
    async (overrideUserIds?: string[]) => {
      const ids = overrideUserIds ?? uniqueIds
      if (ids.length === 0) {
        message.warning('Aucun collaborateur à traiter')
        return
      }
      const isRetry = overrideUserIds != null
      if (isRetry && smtpConfigured === false) {
        message.error(
          'SMTP non configuré sur le serveur : impossible de réessayer l’envoi par e-mail.',
        )
        return
      }
      const send = isRetry ? 'email' : effectiveSendMethod
      setPhase('running')
      try {
        const payload = buildPayload(ids, send)
        const res = await employeesApi.bulkActivate(payload)
        setLastSendMethod(send)
        setResult(res)
        setPhase('done')
        message.success('Traitement terminé')
      } catch (e) {
        setPhase('form')
        message.error(
          getApiErrorMessage(e, "L'activation en masse a échoué"),
        )
      }
    },
    [
      buildPayload,
      effectiveSendMethod,
      message,
      smtpConfigured,
      uniqueIds,
    ],
  )

  const onPrimaryClick = useCallback(() => {
    if (!autoActivate) {
      onFinished?.()
      return
    }
    void runBulkActivate()
  }, [autoActivate, onFinished, runBulkActivate])

  const previewHtml = useMemo(
    () => buildEmailPreviewHtml(customMessage),
    [customMessage],
  )

  const activatedList =
    result?.credentials.filter((c) => c.status === 'activated') ?? []
  const whatsappBlock = useMemo(() => {
    return result?.credentials
      .filter((c) => c.whatsappLink)
      .map((c) => `${c.lastName} ${c.firstName} (${c.email})\n${c.whatsappLink}`)
      .join('\n\n')
  }, [result])

  async function copyWhatsappBlock() {
    if (!whatsappBlock) {
      message.info('Aucun lien WhatsApp')
      return
    }
    try {
      await navigator.clipboard.writeText(whatsappBlock)
      message.success('Liens copiés dans le presse-papier')
    } catch {
      message.error('Copie impossible')
    }
  }

  function channelLabel(c: ActivatedCredential): string {
    if (c.status !== 'activated') {
      return '—'
    }
    const sm = lastSendMethod ?? effectiveSendMethod
    if (sm === 'email') {
      return 'E-mail'
    }
    if (sm === 'pdf') {
      return 'PDF'
    }
    return 'Aucun'
  }

  function statusTag(c: ActivatedCredential) {
    if (c.status === 'activated') {
      return <Tag color="green">Activé</Tag>
    }
    if (c.status === 'already_active') {
      return <Tag>Déjà actif</Tag>
    }
    return <Tag color="red">Erreur</Tag>
  }

  const inner = (
    <div className="activation-step-body">
      {phase === 'done' && result ? (
        <>
          <Paragraph style={{ marginBottom: 8 }}>
            <Text strong>
              {result.summary.activated} compte(s) activé(s),{' '}
              {result.summary.emailsSent} e-mail(s) envoyé(s),{' '}
              {result.summary.emailsFailed} échec(s),{' '}
              {result.summary.alreadyActive} déjà actif(s).
            </Text>
          </Paragraph>
          {result.summary.emailsFailed > 0 ? (
            <Text type="warning" style={{ display: 'block', marginBottom: 8 }}>
              De nouveaux mots de passe seront générés si vous réessayez
              l’envoi pour les échecs.
            </Text>
          ) : null}
          <div className="activation-result-actions">
            {result.pdfDownloadUrl ? (
              <Button
                type="primary"
                className="activation-btn-orange"
                onClick={() => window.open(result.pdfDownloadUrl, '_blank')}
              >
                Télécharger le PDF des identifiants
              </Button>
            ) : null}
            {activatedList.length > 0 ? (
              <Button
                variant="outlined"
                onClick={() => exportActivatedCredentialsCsv(result.credentials)}
              >
                Télécharger le tableau CSV
              </Button>
            ) : null}
            {whatsappBlock ? (
              <Button variant="outlined" onClick={() => void copyWhatsappBlock()}>
                Copier tous les liens WhatsApp
              </Button>
            ) : null}
            {result.emailFailedUserIds && result.emailFailedUserIds.length > 0 ? (
              <Button
                type="primary"
                onClick={() =>
                  void runBulkActivate(result.emailFailedUserIds)
                }
              >
                Réessayer les {result.emailFailedUserIds.length} envoi(s)
                e-mail
              </Button>
            ) : null}
          </div>
          <Collapse
            style={{ marginTop: 16 }}
            items={[
              {
                key: 'table',
                label: 'Détail par collaborateur',
                children: (
                  <Table<ActivatedCredential>
                    size="small"
                    pagination={{ pageSize: 20 }}
                    rowKey="userId"
                    dataSource={result.credentials}
                    columns={[
                      {
                        title: 'Nom',
                        key: 'name',
                        render: (_, r) => `${r.lastName} ${r.firstName}`,
                      },
                      { title: 'E-mail', dataIndex: 'email', ellipsis: true },
                      {
                        title: 'Matricule',
                        dataIndex: 'employeeId',
                        width: 110,
                      },
                      {
                        title: 'Canal',
                        key: 'ch',
                        width: 88,
                        render: (_, r) => channelLabel(r),
                      },
                      {
                        title: 'Statut',
                        key: 'st',
                        width: 120,
                        render: (_, r) => statusTag(r),
                      },
                      {
                        title: 'Message',
                        key: 'err',
                        ellipsis: true,
                        render: (_, r) => r.errorMessage ?? '—',
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
          {onFinished ? (
            <div style={{ marginTop: 16 }}>
              <Button type="primary" onClick={onFinished} className="import-btn-teal">
                Continuer
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Checkbox
              checked={autoActivate}
              onChange={(e) => setAutoActivate(e.target.checked)}
            >
              Activer automatiquement tous les comptes
            </Checkbox>
            {!autoActivate ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Les comptes importés restent inactifs. Vous pourrez les activer
                depuis la page Collaborateurs.
              </Text>
            ) : null}

            {autoActivate ? (
              <>
                <div>
                  <Text style={{ display: 'block', marginBottom: 6 }}>
                    Durée du mot de passe temporaire
                  </Text>
                  <Select
                    style={{ width: '100%', maxWidth: 360 }}
                    value={hours}
                    onChange={(v) => setHours(v)}
                    options={HOUR_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                  />
                </div>

                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Canal d’envoi
                  </Text>
                  <div className="activation-send-cards">
                    <button
                      type="button"
                      className={`activation-send-card ${
                        sendMethod === 'email' ? 'activation-send-card--selected' : ''
                      } ${smtpConfigured === false ? 'activation-send-card--disabled' : ''}`}
                      disabled={smtpConfigured === false}
                      onClick={() => {
                        if (smtpConfigured !== false) {
                          setSendMethod('email')
                        }
                      }}
                    >
                      <div className="activation-send-card__title">
                        <MailOutlined style={{ color: '#0f5c5e' }} /> E-mail
                        automatique
                      </div>
                      <div className="activation-send-card__desc">
                        Envoie un e-mail à chaque collaborateur avec ses
                        identifiants.
                      </div>
                      <span className="activation-tag activation-tag--green">
                        Gratuit
                      </span>
                      <span className="activation-tag activation-tag--gray">
                        Recommandé cadres
                      </span>
                      {smtpConfigured === false ? (
                        <div
                          className="activation-send-card__desc"
                          style={{ marginTop: 6 }}
                        >
                          Configurez le SMTP (variables serveur) pour activer les
                          e-mails.
                        </div>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className={`activation-send-card ${
                        sendMethod === 'pdf' ? 'activation-send-card--selected' : ''
                      }`}
                      onClick={() => setSendMethod('pdf')}
                    >
                      <div className="activation-send-card__title">
                        <PrinterOutlined style={{ color: '#f28c28' }} /> Fiche
                        PDF à imprimer
                      </div>
                      <div className="activation-send-card__desc">
                        PDF avec les identifiants, 4 fiches par page à découper.
                      </div>
                      <span className="activation-tag activation-tag--orange">
                        Idéal terrain
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`activation-send-card ${
                        sendMethod === 'none' ? 'activation-send-card--selected' : ''
                      }`}
                      onClick={() => setSendMethod('none')}
                    >
                      <div className="activation-send-card__title">
                        <AudioMutedOutlined style={{ color: '#7f8c8d' }} /> Aucun
                        envoi
                      </div>
                      <div className="activation-send-card__desc">
                        Active les comptes sans envoi automatique ; téléchargez le
                        CSV des mots de passe.
                      </div>
                    </button>
                  </div>
                </div>

                <Checkbox
                  checked={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.checked)}
                >
                  Générer aussi les liens WhatsApp
                </Checkbox>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                  Un lien pré-formaté par collaborateur, à copier-coller dans
                  WhatsApp.
                </Text>

                <div>
                  <Text style={{ display: 'block', marginBottom: 6 }}>
                    Message de l’admin (optionnel)
                  </Text>
                  <TextArea
                    rows={3}
                    maxLength={500}
                    showCount
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Ex. : Bienvenue dans l’équipe !"
                  />
                </div>

                <Collapse
                  items={[
                    {
                      key: 'preview',
                      label: 'Aperçu du message e-mail',
                      children: (
                        <div
                          className="activation-preview-html"
                          // eslint-disable-next-line react/no-danger
                          dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                      ),
                    },
                  ]}
                />
              </>
            ) : null}
          </Space>

          {phase === 'running' ? (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <Spin size="large" />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Activation et envoi en cours… (peut prendre plusieurs minutes)
                </Text>
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <Button
              type="primary"
              size="large"
              className="activation-btn-orange"
              loading={phase === 'running'}
              disabled={phase === 'running' || (autoActivate && uniqueIds.length === 0)}
              onClick={() => void onPrimaryClick()}
            >
              {autoActivate
                ? `Activer ${uniqueIds.length} collaborateur(s) et envoyer les invitations`
                : 'Terminer sans activer'}
            </Button>
          </div>
        </>
      )}
    </div>
  )

  if (variant === 'plain') {
    return <div className="activation-step-plain">{inner}</div>
  }

  return (
    <div className="activation-step-card">
      <div className="activation-step-header">
        <div className="activation-step-icon">
          <SendOutlined />
        </div>
        <div>
          <h3 className="activation-step-title">
            Activer et inviter les collaborateurs
          </h3>
          <p className="activation-step-sub">
            Les comptes seront activés avec un mot de passe temporaire. Chaque
            collaborateur devra le changer à la première connexion sur
            l’application.
          </p>
        </div>
      </div>
      {inner}
    </div>
  )
}
