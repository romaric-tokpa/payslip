import { Space } from 'antd'
import type { ReactNode } from 'react'
import { adminTheme } from '../theme/adminTheme'

export interface PageHeaderProps {
  /** Omis lorsque le titre est déjà affiché dans le header du layout (`AdminLayout`). */
  title?: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const hasTitle = title != null && title !== ''
  const hasSubtitle = subtitle != null && subtitle !== ''
  const hasHeading = hasTitle || hasSubtitle

  if (!hasHeading && actions == null) {
    return null
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: hasHeading ? 'space-between' : 'flex-end',
        gap: 16,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
    >
      {hasHeading ? (
        <div>
          {hasTitle ? (
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: adminTheme.dark,
                lineHeight: 1.3,
              }}
            >
              {title}
            </h1>
          ) : null}
          {hasSubtitle ? (
            <p
              style={{
                margin: hasTitle ? '4px 0 0' : 0,
                fontSize: 15,
                color: adminTheme.gray,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
      {actions != null ? <Space wrap>{actions}</Space> : null}
    </div>
  )
}
