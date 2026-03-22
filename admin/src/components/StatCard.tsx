import { Typography } from 'antd'
import { adminTheme } from '../theme/adminTheme'

const { Text } = Typography

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
  return (
    <div
      style={{
        background: adminTheme.white,
        borderRadius: adminTheme.cardRadius,
        padding: 14,
        borderLeft: `3px solid ${borderColor}`,
        boxSizing: 'border-box',
      }}
    >
      <Text
        style={{
          display: 'block',
          fontSize: 11,
          color: adminTheme.gray,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
          color: borderColor,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {subtitle != null && subtitle !== '' ? (
        <Text
          style={{
            display: 'block',
            marginTop: 6,
            fontSize: 11,
            color: subColor,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </div>
  )
}
