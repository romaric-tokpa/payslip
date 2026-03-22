import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from 'react'

export type KpiCardProps = {
  label: string
  value: string | number
  suffix?: ReactNode
  valueColor?: string
  trend?: number
  trendLabel?: string
  trendSuffix?: string
  onClick?: () => void
}

const baseCard: CSSProperties = {
  background: 'white',
  borderRadius: 16,
  border: '0.5px solid #E8E8E8',
  padding: '20px 24px',
  transition: 'transform 0.2s, box-shadow 0.2s',
}

export function KpiCard({
  label,
  value,
  suffix,
  valueColor = '#1C2833',
  trend,
  trendLabel,
  trendSuffix = '',
  onClick,
}: KpiCardProps) {
  const interactive = Boolean(onClick)

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!interactive) {
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  function onMouseEnter(e: MouseEvent<HTMLDivElement>) {
    if (!interactive) {
      return
    }
    e.currentTarget.style.transform = 'translateY(-2px)'
    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.04)'
  }

  function onMouseLeave(e: MouseEvent<HTMLDivElement>) {
    e.currentTarget.style.transform = ''
    e.currentTarget.style.boxShadow = ''
  }

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={{
        ...baseCard,
        cursor: interactive ? 'pointer' : 'default',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{ fontSize: 13, color: '#7F8C8D', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: valueColor,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {suffix != null && suffix !== '' ? (
          <span style={{ fontSize: 14, color: '#BDC3C7' }}>{suffix}</span>
        ) : null}
      </div>
      {trend !== undefined ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 4,
            color:
              trend > 0 ? '#27AE60' : trend < 0 ? '#E24B4A' : '#BDC3C7',
          }}
        >
          <span>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}{' '}
            {trend > 0 ? '+' : ''}
            {trend}
            {trendSuffix}
          </span>
          {trendLabel ? (
            <span style={{ color: '#BDC3C7', fontWeight: 400 }}>
              {trendLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
