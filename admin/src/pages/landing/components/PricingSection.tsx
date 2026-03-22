import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Reveal } from './Reveal'
import { IconCheck } from './icons'

const PLANS = {
  starter: { monthly: 25_000, annual: 20_000, perMonthly: 500, perAnnual: 400 },
  business: { monthly: 200_000, annual: 160_000, perMonthly: 400, perAnnual: 320 },
  /** Au-delà de 500 collaborateurs, facturation au prorata. */
  enterprise: { perMonthly: 250, perAnnual: 200 },
} as const

function usePriceTransition(isAnnual: boolean) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setVisible(false)
    const timer = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(timer)
  }, [isAnnual])

  return { opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease' } as const
}

export function PricingSection() {
  const navigate = useNavigate()
  const [isAnnual, setIsAnnual] = useState(false)
  const priceStyle = usePriceTransition(isAnnual)

  const starterMain = isAnnual ? PLANS.starter.annual : PLANS.starter.monthly
  const starterPer = isAnnual ? PLANS.starter.perAnnual : PLANS.starter.perMonthly
  const businessMain = isAnnual ? PLANS.business.annual : PLANS.business.monthly
  const businessPer = isAnnual ? PLANS.business.perAnnual : PLANS.business.perMonthly
  const enterprisePer = isAnnual ? PLANS.enterprise.perAnnual : PLANS.enterprise.perMonthly

  return (
    <section id="pricing" className="lp-pricing lp-pricing-section" aria-labelledby="lp-pricing-title">
      <div className="lp-container">
        <header className="lp-pricing-head">
          <Reveal delay={0}>
            <p className="lp-pr-tag">
              <span className="lp-pr-tag-inner">Tarifs</span>
            </p>
          </Reveal>
          <Reveal delay={1}>
            <h2 id="lp-pricing-title" className="lp-pr-title">
              Dégressif et transparent
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="lp-pr-lead">Plus vous grandissez, moins vous payez par collaborateur.</p>
          </Reveal>
        </header>

        <Reveal delay={1}>
          <div className="lp-pricing-toggle-wrap">
            <div className="lp-pricing-toggle-row">
              <span className={`lp-pricing-toggle-label ${!isAnnual ? 'lp-pricing-toggle-label--active' : ''}`}>
                Mensuel
              </span>

              <button
                type="button"
                role="switch"
                aria-checked={isAnnual}
                aria-label="Basculer entre tarification mensuelle et annuelle"
                className="lp-pricing-toggle-track"
                onClick={() => setIsAnnual((v) => !v)}
              >
                <span className="lp-pricing-toggle-knob" />
              </button>

              <span className={`lp-pricing-toggle-label ${isAnnual ? 'lp-pricing-toggle-label--active' : ''}`}>
                Annuel
              </span>

              <span className={`lp-pricing-discount ${isAnnual ? 'lp-pricing-discount--visible' : ''}`} aria-hidden={!isAnnual}>
                −20&nbsp;%
              </span>
            </div>
          </div>
        </Reveal>

        <div className="pricing-grid">
          <Reveal delay={0} className="pricing-reveal">
            <article className="pricing-card pricing-card--starter">
              <div className="pc-tier">
                <span className="pc-name">Starter</span>
                <span className="pc-range">1 — 50 collaborateurs</span>
              </div>
              <div className="pc-price-block">
                <div className="pc-price-row">
                  <span className="pc-price-amount" style={priceStyle}>
                    {starterMain.toLocaleString('fr-FR')}
                  </span>
                  <span className="pc-price-unit">F/mois</span>
                </div>
                <div className="pc-price-per" style={priceStyle}>
                  {starterPer}&nbsp;F / collaborateur
                </div>
              </div>
              <div className="pc-divider" />
              <ul className="pc-features">
                <li className="pc-feat">
                  <IconCheck size={13} />
                  Upload + distribution
                </li>
                <li className="pc-feat">
                  <IconCheck size={13} />
                  App mobile
                </li>
                <li className="pc-feat">
                  <IconCheck size={13} />
                  Dashboard
                </li>
              </ul>
              <button type="button" className="pc-btn pc-btn-outline" onClick={() => navigate('/register')}>
                Commencer
              </button>
            </article>
          </Reveal>

          <Reveal delay={1} className="pricing-reveal pricing-reveal-business">
            <article className="pricing-card pricing-card-business">
              <div className="pc-ribbon">Populaire</div>
              <div className="pc-tier">
                <span className="pc-name pc-name-business">Business</span>
                <span className="pc-range">51 — 500 collaborateurs</span>
              </div>
              <div className="pc-price-block">
                <div className="pc-price-row">
                  <span className="pc-price-amount" style={priceStyle}>
                    {businessMain.toLocaleString('fr-FR')}
                  </span>
                  <span className="pc-price-unit">F/mois</span>
                </div>
                <div className="pc-price-per" style={priceStyle}>
                  {businessPer}&nbsp;F / collaborateur
                </div>
              </div>
              <div className="pc-divider" />
              <ul className="pc-features">
                <li className="pc-feat">
                  <IconCheck size={13} />
                  Tout Starter +
                </li>
                <li className="pc-feat pc-feat-orange">
                  <IconCheck size={13} />
                  Import intelligent PDF
                </li>
                <li className="pc-feat pc-feat-orange">
                  <IconCheck size={13} />
                  Organigramme + CDD
                </li>
                <li className="pc-feat pc-feat-orange">
                  <IconCheck size={13} />
                  Push notifications
                </li>
              </ul>
              <button type="button" className="pc-btn pc-btn-solid" onClick={() => navigate('/register')}>
                Essai gratuit 14 jours
              </button>
            </article>
          </Reveal>

          <Reveal delay={2} className="pricing-reveal">
            <article className="pricing-card pricing-card--enterprise">
              <div className="pc-tier">
                <span className="pc-name">Enterprise</span>
                <span className="pc-range">Plus de 500 collaborateurs</span>
              </div>
              <div className="pc-price-block">
                <div className="pc-price-row">
                  <span className="pc-price-amount" style={priceStyle}>
                    {enterprisePer.toLocaleString('fr-FR')}
                  </span>
                  <span className="pc-price-unit">F&nbsp;/&nbsp;collab.&nbsp;/&nbsp;mois</span>
                </div>
                <div className="pc-price-per" style={priceStyle}>
                  Facturation mensuelle au prorata du nombre de collaborateurs
                </div>
              </div>
              <div className="pc-divider" />
              <ul className="pc-features">
                <li className="pc-feat">
                  <IconCheck size={13} />
                  Tout Business +
                </li>
                <li className="pc-feat">
                  <IconCheck size={13} />
                  SSO + API
                </li>
                <li className="pc-feat">
                  <IconCheck size={13} />
                  Support dédié + SLA
                </li>
              </ul>
              <button
                type="button"
                className="pc-btn pc-btn-muted"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Nous contacter
              </button>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
