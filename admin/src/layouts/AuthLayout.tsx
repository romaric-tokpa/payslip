import type { ReactNode } from 'react'
import './auth-layout.css'

export type AuthLayoutProps = {
  leftContent: ReactNode
  /** Titre court sous le logo en vue tablette (600–900px) */
  leftTabletTitle?: ReactNode
  children: ReactNode
}

export function AuthLayout({
  leftContent,
  leftTabletTitle,
  children,
}: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <aside className="auth-layout__left">
        <div className="auth-layout__left-inner">
          <div className="auth-layout__left-brand">
            <img
              src="/logo-stacked-sider.svg"
              alt="PaySlip Manager"
              className="auth-layout__logo-img auth-layout__logo-img--enter"
              width={360}
              height={310}
              decoding="async"
            />
          </div>
          {leftTabletTitle != null ? (
            <div className="auth-layout__left-tablet-title">{leftTabletTitle}</div>
          ) : null}
          <div className="auth-layout__left-full">{leftContent}</div>
        </div>
        <div className="auth-layout__footer">Propulsé par Yemma Solutions</div>
      </aside>
      <main className="auth-layout__right">
        <div className="auth-layout__right-inner">{children}</div>
      </main>
    </div>
  )
}
