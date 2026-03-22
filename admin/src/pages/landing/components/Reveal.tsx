import type { ReactNode } from 'react'
import { useScrollReveal } from '../hooks/useScrollReveal'

export type RevealDelay = 0 | 1 | 2 | 3 | 4

export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: RevealDelay
  className?: string
}) {
  const ref = useScrollReveal<HTMLDivElement>()
  const d = delay > 0 ? `d${delay}` : ''
  const cn = `sr ${d} ${className}`.trim()

  return (
    <div ref={ref} className={cn}>
      {children}
    </div>
  )
}
