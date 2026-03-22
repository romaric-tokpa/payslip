import { useScrollReveal } from '../hooks/useScrollReveal'
import { Reveal } from './Reveal'

const beforeMetrics = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    value: '2 jours',
    desc: 'de travail perdus',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22 6 12 13 2 6" />
      </svg>
    ),
    value: '1 800',
    desc: 'emails manuels',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    ),
    value: '23%',
    desc: 'jamais consultés',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <line x1="4" y1="4" x2="20" y2="20" />
      </svg>
    ),
    value: '0',
    desc: 'traçabilité',
  },
] as const

const afterMetrics = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    value: '10 min',
    desc: "c'est tout",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    value: '1 clic',
    desc: 'pour tout distribuer',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    value: '94%',
    desc: 'taux de consultation',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    value: '100%',
    desc: 'traçabilité totale',
  },
] as const

export default function BeforeAfterSection() {
  const gridRef = useScrollReveal<HTMLDivElement>()

  return (
    <section
      className="lp-before-after lp-before-after-section lp-compare-section"
      id="compare"
      aria-labelledby="lp-ba-heading"
    >
      <div className="lp-container">
        <header className="lp-ba-header">
          <Reveal>
            <p className="lp-ba-tag">
              <span className="lp-ba-tag-inner">Avant vs après</span>
            </p>
          </Reveal>
          <Reveal delay={1}>
            <h2 id="lp-ba-heading" className="lp-ba-title">
              Le changement est radical
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="lp-ba-lead">
              La même mission — deux réalités. Voici ce que PaySlip Manager change au quotidien pour votre équipe RH.
            </p>
          </Reveal>
        </header>

        <div ref={gridRef} className="lp-ba-grid compare-grid">
          <div className="lp-ba-panel lp-ba-before">
            <div className="lp-ba-panel-head">
              <span className="lp-ba-panel-badge lp-ba-panel-badge--before" aria-hidden>
                Avant
              </span>
              <h3 className="lp-ba-panel-title">Sans PaySlip Manager</h3>
            </div>
            <div className="lp-ba-panel-body">
              {beforeMetrics.map((m) => (
                <article className="lp-ba-card lp-ba-card--before" key={m.desc}>
                  <div className="lp-ba-metric-icon" aria-hidden>
                    {m.icon}
                  </div>
                  <div className="lp-ba-metric-copy">
                    <div className="lp-ba-metric-value">{m.value}</div>
                    <div className="lp-ba-metric-desc">{m.desc}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="lp-ba-bridge" aria-hidden>
            <div className="lp-ba-bridge-axis" />
            <div className="lp-ba-arrow">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <span className="lp-ba-bridge-label">VS</span>
          </div>

          <div className="lp-ba-panel lp-ba-after">
            <div className="lp-ba-panel-head">
              <span className="lp-ba-panel-badge lp-ba-panel-badge--after" aria-hidden>
                Après
              </span>
              <h3 className="lp-ba-panel-title">Avec PaySlip Manager</h3>
            </div>
            <div className="lp-ba-panel-body">
              {afterMetrics.map((m) => (
                <article className="lp-ba-card lp-ba-card--after" key={m.desc}>
                  <div className="lp-ba-metric-icon" aria-hidden>
                    {m.icon}
                  </div>
                  <div className="lp-ba-metric-copy">
                    <div className="lp-ba-metric-value">{m.value}</div>
                    <div className="lp-ba-metric-desc">{m.desc}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
