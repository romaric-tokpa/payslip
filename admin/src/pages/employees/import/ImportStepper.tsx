import { CheckOutlined } from '@ant-design/icons'
import './import-flow.css'

const STEPS = [
  { key: 0, label: 'Fichier' },
  { key: 1, label: 'Mapping' },
  { key: 2, label: 'Organisation' },
  { key: 3, label: 'Vérification' },
  { key: 4, label: 'Résultat' },
] as const

type ImportStepperProps = {
  current: number
  /** Si false, l’étape Organisation est sautée (affichée comme terminée dès la vérification). */
  needOrgStep: boolean
}

function segmentDone(
  stepKey: number,
  current: number,
  needOrgStep: boolean,
): boolean {
  if (stepKey === 2) {
    return needOrgStep ? current > 2 : current >= 3
  }
  return current > stepKey
}

function segmentActive(
  stepKey: number,
  current: number,
  needOrgStep: boolean,
): boolean {
  if (stepKey === 2) {
    return Boolean(needOrgStep && current === 2)
  }
  return current === stepKey
}

export function ImportStepper({ current, needOrgStep }: ImportStepperProps) {
  return (
    <div className="import-stepper" role="list">
      {STEPS.map((s, index) => {
        const isActive = segmentActive(s.key, current, needOrgStep)
        const isDone = segmentDone(s.key, current, needOrgStep)
        const isFirst = index === 0
        const isLast = index === STEPS.length - 1
        const segmentClass = [
          'import-stepper__segment',
          isActive ? 'import-stepper__segment--active' : '',
          isDone ? 'import-stepper__segment--done' : '',
          !isActive && !isDone ? 'import-stepper__segment--future' : '',
          isFirst ? 'import-stepper__segment--first' : '',
          isLast ? 'import-stepper__segment--last' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div key={s.key} className={segmentClass} role="listitem">
            <div className="import-stepper__inner">
              <span className="import-stepper__circle" aria-hidden>
                {isDone ? (
                  <CheckOutlined className="import-stepper__check" />
                ) : (
                  <span className="import-stepper__num">{s.key + 1}</span>
                )}
              </span>
              <span className="import-stepper__label">{s.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
