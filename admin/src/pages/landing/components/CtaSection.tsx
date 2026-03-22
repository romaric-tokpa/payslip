import { useNavigate } from 'react-router-dom'
import { scrollToSection } from '../constants'
import { Reveal } from './Reveal'
import { IconArrowRight, IconCheck } from './icons'

const CTA_CHECKS = ['Accès complet', '500 collaborateurs', 'Support inclus', 'Sans carte bancaire'] as const

export function CtaSection() {
  const navigate = useNavigate()

  return (
    <section
      className="lp-cta lp-cta-section"
      id="contact"
      aria-labelledby="lp-cta-heading"
    >
      <div className="cta-backdrop" aria-hidden>
        <div className="cta-blob cta-blob--tr" />
        <div className="cta-blob cta-blob--bl" />
        <div className="cta-grid-pattern" />
      </div>
      <div className="lp-container">
        <div className="cta-inner">
          <Reveal delay={0}>
            <div className="cta-left">
              <p className="cta-eyebrow">
                <span className="cta-eyebrow-inner">Essai gratuit</span>
              </p>
              <h2 id="lp-cta-heading" className="cta-title">
                <span className="cta-title-kicker">Prêt à gagner</span>
                <span className="cta-title-stack">
                  <span className="cta-title-days">2 jours</span>
                  <span className="cta-title-rest">par mois ?</span>
                </span>
              </h2>
              <p className="cta-sub">
                14 jours gratuits, sans engagement ni carte bancaire. Votre espace est prêt en quelques minutes.
              </p>
              <div className="cta-btn-row">
                <button
                  type="button"
                  className="cta-btn-primary btn-glow"
                  onClick={() => navigate('/register')}
                >
                  Démarrer maintenant
                  <IconArrowRight size={14} aria-hidden />
                </button>
                <button type="button" className="cta-btn-secondary" onClick={() => scrollToSection('product')}>
                  Voir comment ça marche
                </button>
              </div>
            </div>
          </Reveal>

          <Reveal delay={1} className="cta-card-reveal">
            <aside className="cta-card" aria-label="Détails de l&apos;essai">
              <div className="cta-card-shine" aria-hidden />
              <div className="cta-card-num-wrap">
                <span className="cta-card-num">14</span>
              </div>
              <p className="cta-card-label">jours d&apos;essai gratuit</p>
              <div className="cta-card-divider" aria-hidden />
              <ul className="cta-card-list">
                {CTA_CHECKS.map((text) => (
                  <li key={text} className="cta-card-item">
                    <span className="cta-card-check" aria-hidden>
                      <IconCheck size={12} />
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
