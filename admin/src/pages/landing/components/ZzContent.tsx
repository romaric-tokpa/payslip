export interface ZzContentProps {
  stepNumber: number
  stepLabel: string
  /** Teal / orange / green — réservé pour extensions (couleurs via stepBgColor / stepTextColor) */
  stepColor: string
  stepBgColor: string
  stepTextColor: string
  title: string
  description: string
  badgeVariant?: 'circle' | 'check'
}

export function ZzContent({
  stepNumber,
  stepLabel,
  stepColor,
  stepBgColor,
  stepTextColor,
  title,
  description,
  badgeVariant = 'circle',
}: ZzContentProps) {
  return (
    <div className="lp-how-step-text">
      <div
        className="zz-step-tag"
        data-accent={stepColor}
        style={{
          backgroundColor: stepBgColor,
          color: stepTextColor,
        }}
      >
        {badgeVariant === 'circle' ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span>{stepLabel}</span>
      </div>
      <h3 className="zz-how-title" id={`lp-how-step-${stepNumber}`}>
        {title}
      </h3>
      <p className="zz-how-desc">{description}</p>
    </div>
  )
}
