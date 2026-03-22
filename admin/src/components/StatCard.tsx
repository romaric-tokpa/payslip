import type { CSSProperties } from 'react'

export interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  borderColor: string
  subtitleColor?: string
}

export function StatCard({
  label,
  value,
  subtitle,
  borderColor,
  subtitleColor,
}: StatCardProps) {
  const subColor = subtitleColor ?? borderColor
  const cssVars = {
    '--stat-accent': borderColor,
    '--stat-value': borderColor,
    '--stat-sub': subColor,
  } as CSSProperties

  return (
    <div className="stat-card" style={cssVars}>
      <span className="stat-card__label">{label}</span>
      <div className="stat-card__value">{value}</div>
      {subtitle != null && subtitle !== '' ? (
        <span className="stat-card__subtitle">{subtitle}</span>
      ) : null}
    </div>
  )
}
