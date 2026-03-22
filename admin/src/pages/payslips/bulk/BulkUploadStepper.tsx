import { CheckOutlined } from '@ant-design/icons'
import '../payslip-upload.css'

const STEPS = [
  { key: 0, label: 'Dépôt' },
  { key: 1, label: 'Vérification' },
  { key: 2, label: 'Résultat' },
] as const

type BulkUploadStepperProps = {
  current: number
}

export function BulkUploadStepper({ current }: BulkUploadStepperProps) {
  return (
    <div className="bulk-payslip-stepper" role="list">
      {STEPS.map((s, index) => {
        const isActive = current === s.key
        const isDone = current > s.key
        const isFirst = index === 0
        const isLast = index === STEPS.length - 1
        const segmentClass = [
          'bulk-payslip-stepper__segment',
          isActive ? 'bulk-payslip-stepper__segment--active' : '',
          isDone ? 'bulk-payslip-stepper__segment--done' : '',
          !isActive && !isDone ? 'bulk-payslip-stepper__segment--future' : '',
          isFirst ? 'bulk-payslip-stepper__segment--first' : '',
          isLast ? 'bulk-payslip-stepper__segment--last' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <div key={s.key} className={segmentClass} role="listitem">
            <div className="bulk-payslip-stepper__inner">
              <span className="bulk-payslip-stepper__circle" aria-hidden>
                {isDone ? (
                  <CheckOutlined className="bulk-payslip-stepper__check" />
                ) : (
                  <span>{s.key + 1}</span>
                )}
              </span>
              <span className="bulk-payslip-stepper__label">{s.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
