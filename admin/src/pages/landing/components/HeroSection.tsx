import { useNavigate } from 'react-router-dom'
import { useCountUp } from '../hooks/useCountUp'
import { Reveal } from './Reveal'
import { IconArrowRight, IconCheck, IconPlay } from './icons'

/** Hauteurs relatives au conteneur (30 %–85 %) pour lisibilité */
const BAR_HEIGHTS = ['38%', '85%', '52%', '72%', '44%', '68%'] as const

export function HeroSection() {
  const navigate = useNavigate()
  const dist = useCountUp(1847)
  const pct = useCountUp(94)

  return (
    <section className="lp-hero lp-hero-section" aria-labelledby="lp-hero-heading">
      <div className="lp-hero-bg" aria-hidden />
      <div className="lp-hero-blob lp-hero-blob-1" aria-hidden />
      <div className="lp-hero-blob lp-hero-blob-2" aria-hidden />
      <div className="lp-hero-blob lp-hero-blob-3" aria-hidden />

      <div className="lp-container">
        <div className="lp-hero-grid hero-grid">
          <div className="lp-hero-col-left">
            <Reveal>
              <p className="lp-hero-badge">
                <span className="lp-hero-badge-dot" aria-hidden />
                <span className="lp-hero-badge-text">+200 entreprises en Afrique de l&apos;Ouest</span>
              </p>
            </Reveal>

            <Reveal delay={1}>
              <h1 id="lp-hero-heading" className="hero-title">
                Ne perdez plus{' '}
                <span className="lp-hero-highlight-wrap">
                  <span className="lp-hero-highlight">de temps</span>
                  <svg
                    className="lp-hero-title-underline"
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      d="M0 6 Q25 0 50 4 Q75 8 100 2"
                      fill="none"
                      stroke="#F28C28"
                      strokeWidth="2.5"
                      opacity="0.55"
                    />
                  </svg>
                </span>
                <br />
                avec vos bulletins
              </h1>
            </Reveal>

            <Reveal delay={2}>
              <p className="lp-hero-sub">
                Uploadez, le système identifie, vos collaborateurs reçoivent. C&apos;est aussi simple que ça.
              </p>
            </Reveal>

            <Reveal delay={3}>
              <div className="lp-hero-ctas">
                <button type="button" className="lp-hero-btn-primary btn-glow" onClick={() => navigate('/register')}>
                  Essai gratuit 14 jours
                  <IconArrowRight size={18} />
                </button>
                <button
                  type="button"
                  className="lp-hero-btn-secondary"
                  onClick={() => document.getElementById('product')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <span className="lp-hero-play" aria-hidden>
                    <IconPlay size={11} />
                  </span>
                  <span>Démo 2 min</span>
                </button>
              </div>
            </Reveal>

            <Reveal delay={4}>
              <ul className="lp-hero-trust-list">
                <li className="lp-hero-trust-item">
                  <span className="lp-hero-trust-icon" aria-hidden>
                    <IconCheck size={15} />
                  </span>
                  Sans carte bancaire
                </li>
                <li className="lp-hero-trust-item">
                  <span className="lp-hero-trust-icon" aria-hidden>
                    <IconCheck size={15} />
                  </span>
                  Setup 5 min
                </li>
              </ul>
            </Reveal>
          </div>

          <Reveal delay={2} className="lp-hero-col-right">
            <div className="lp-hero-mock-wrap">
              <div className="lp-mock" aria-label="Aperçu du tableau de distribution">
                <div className="lp-mock-chrome" aria-hidden>
                  <div className="lp-mock-dots">
                    <span className="lp-mock-dot" />
                    <span className="lp-mock-dot" />
                    <span className="lp-mock-dot" />
                  </div>
                  <span className="lp-mock-chrome-title">Distribution paie</span>
                </div>

                <div className="lp-mock-chart">
                  <div className="lp-mock-chart-head">
                    <span className="lp-mock-chart-title">Mars 2026</span>
                    <span className="lp-mock-chart-status">
                      <span className="lp-mock-status-dot" aria-hidden />
                      Terminée
                    </span>
                  </div>
                  <div className="lp-bars" role="presentation">
                    {BAR_HEIGHTS.map((h, i) => (
                      <div key={i} className={`lp-bar${i === BAR_HEIGHTS.length - 1 ? ' lp-bar-accent' : ''}`} style={{ height: h }} />
                    ))}
                  </div>
                </div>

                <div className="lp-kpi-grid">
                  <div className="lp-kpi">
                    <div className="lp-kpi-label">Distribués</div>
                    <div className="lp-kpi-val">
                      <span ref={dist.ref}>{dist.count}</span>
                    </div>
                  </div>
                  <div className="lp-kpi lp-kpi-highlight">
                    <div className="lp-kpi-label">Consultés</div>
                    <div className="lp-kpi-val lp-kpi-val-green">
                      <span ref={pct.ref}>{pct.count}</span>%
                    </div>
                  </div>
                </div>

                <div className="lp-hero-notify">
                  <span className="lp-hero-notify-dot" aria-hidden />
                  <span className="lp-hero-notify-text">1 847 bulletins envoyés</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
