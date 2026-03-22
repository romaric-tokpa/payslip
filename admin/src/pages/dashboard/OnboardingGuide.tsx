import {
  CheckOutlined,
  CloudUploadOutlined,
  ImportOutlined,
  PartitionOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Button, Progress, Tag, Typography } from 'antd'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ADMIN_BASE } from '../../constants/adminRoutes'
import { adminTheme } from '../../theme/adminTheme'
import type { DashboardStats } from '../../types/dashboard'
import './onboarding-guide.css'

const { Text } = Typography

type StepDef = {
  n: number
  title: string
  description: string
  to: string
  cta: string
  done: boolean
  icon: ReactNode
}

function isOnboardingComplete(s: DashboardStats): boolean {
  return (
    s.totalDepartments > 0 &&
    s.totalEmployees > 0 &&
    s.activeEmployees > 0 &&
    s.totalPayslips > 0
  )
}

export function onboardingStepsFromStats(stats: DashboardStats): StepDef[] {
  return [
    {
      n: 1,
      title: 'Configurez votre organigramme',
      description:
        'Créez vos directions, départements et services pour structurer l’entreprise et préparer les imports.',
      to: `${ADMIN_BASE}/orgchart`,
      cta: 'Accéder à l’organigramme',
      done: stats.totalDepartments > 0,
      icon: <PartitionOutlined aria-hidden />,
    },
    {
      n: 2,
      title: 'Importez vos collaborateurs',
      description:
        'Ajoutez vos équipes à partir d’un fichier Excel ou CSV : moins de saisie manuelle, moins d’erreurs.',
      to: `${ADMIN_BASE}/employees/import`,
      cta: 'Importer un fichier',
      done: stats.totalEmployees > 0,
      icon: <ImportOutlined aria-hidden />,
    },
    {
      n: 3,
      title: 'Activez leurs comptes',
      description:
        'Envoyez les invitations et les mots de passe temporaires pour que chacun accède à son espace sécurisé.',
      to: `${ADMIN_BASE}/employees`,
      cta: 'Voir les collaborateurs',
      done: stats.activeEmployees > 0,
      icon: <TeamOutlined aria-hidden />,
    },
    {
      n: 4,
      title: 'Déposez vos bulletins',
      description:
        'Chargez les PDF par période : vos collaborateurs les retrouvent sur mobile, avec historique et preuve de consultation.',
      to: `${ADMIN_BASE}/payslips/upload`,
      cta: 'Uploader des bulletins',
      done: stats.totalPayslips > 0,
      icon: <CloudUploadOutlined aria-hidden />,
    },
  ]
}

export { isOnboardingComplete }

type OnboardingGuideProps = {
  stats: DashboardStats
}

export function OnboardingGuide({ stats }: OnboardingGuideProps) {
  const { user } = useAuth()
  const steps = onboardingStepsFromStats(stats)
  const doneCount = steps.filter((s) => s.done).length
  const firstPendingIndex = steps.findIndex((s) => !s.done)
  const percent = Math.round((doneCount / steps.length) * 100)

  const referentName = [user?.firstName?.trim(), user?.lastName?.trim()]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="onboarding-guide">
      <header className="onboarding-guide__hero" aria-labelledby="onboarding-title">
        <div className="onboarding-guide__hero-inner">
          <span className="onboarding-guide__kicker">Premiers pas</span>
          <h1 id="onboarding-title" className="onboarding-guide__title">
            {referentName.length > 0 ? (
              <>
                Bienvenue{' '}
                <span style={{ color: adminTheme.orange }}>{referentName}</span>
              </>
            ) : (
              'Bienvenue sur PaySlip Manager'
            )}
          </h1>
          <p className="onboarding-guide__subtitle">
            Quatre étapes suffisent pour un espace opérationnel : structure, équipes,
            accès collaborateurs, puis bulletins. Vous pouvez les suivre dans l’ordre ou
            revenir plus tard — votre progression est enregistrée automatiquement.
          </p>
        </div>
      </header>

      <div className="onboarding-guide__progress-wrap">
        <div className="onboarding-guide__progress-meta">
          <Text type="secondary">
            {`${doneCount} sur ${steps.length} étapes terminées`}
          </Text>
          <Text type="secondary" strong style={{ color: adminTheme.teal }}>
            {percent} %
          </Text>
        </div>
        <Progress
          percent={percent}
          showInfo={false}
          strokeColor={{
            '0%': adminTheme.teal,
            '100%': adminTheme.tealLight,
          }}
          trailColor="rgba(15, 92, 94, 0.08)"
          className="onboarding-guide__progress-bar"
          strokeWidth={8}
        />
      </div>

      <div className="onboarding-guide__steps" role="list">
        {steps.map((step, index) => {
          const isCurrent = !step.done && index === firstPendingIndex
          const stateClass = step.done
            ? 'onboarding-guide__step--done'
            : isCurrent
              ? 'onboarding-guide__step--current'
              : 'onboarding-guide__step--pending'

          const tag = step.done ? (
            <Tag color="success" className="onboarding-guide__tag">
              Terminé
            </Tag>
          ) : isCurrent ? (
            <Tag
              color="processing"
              className="onboarding-guide__tag"
              style={{ background: adminTheme.tealBg, color: adminTheme.teal, borderColor: 'transparent' }}
            >
              À faire en priorité
            </Tag>
          ) : (
            <Tag className="onboarding-guide__tag" style={{ color: adminTheme.gray, borderColor: adminTheme.border }}>
              À faire
            </Tag>
          )

          return (
            <div
              key={step.n}
              className={`onboarding-guide__step ${stateClass}`}
              role="listitem"
            >
              <div className="onboarding-guide__rail" aria-hidden="true">
                <div
                  className={`onboarding-guide__rail-line--up ${index === 0 ? 'is-empty' : ''}`}
                />
                <div className="onboarding-guide__bullet">
                  {step.done ? <CheckOutlined /> : step.icon}
                </div>
                <div
                  className={`onboarding-guide__rail-line--down ${index === steps.length - 1 ? 'is-empty' : ''}`}
                />
              </div>

              <article className="onboarding-guide__card">
                <div className="onboarding-guide__card-head">
                  <h2 className="onboarding-guide__card-title">
                    <span className="onboarding-guide__sr-only">Étape {step.n}. </span>
                    {step.title}
                  </h2>
                  {tag}
                </div>
                <p className="onboarding-guide__card-desc">{step.description}</p>
                <Link to={step.to}>
                  <Button
                    type={isCurrent ? 'primary' : 'default'}
                    className="onboarding-guide__cta"
                  >
                    {step.cta}
                  </Button>
                </Link>
              </article>
            </div>
          )
        })}
      </div>
    </div>
  )
}
