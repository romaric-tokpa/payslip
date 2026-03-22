import { useEffect, useRef, useState } from 'react'
import { Reveal } from './Reveal'
import { IconBook, IconCheck, IconClock, IconShield, IconSmartphone, IconUsersPlus } from './icons'

const CDD_HEIGHTS = [40, 60, 45, 80, 30, 95] as const
const CDD_COLORS = ['#EAFAF1', '#EAFAF1', '#EAFAF1', '#FEF3E5', '#EAFAF1', '#FDEDEC'] as const

function AlertesCddCard() {
  const chartRef = useRef<HTMLDivElement>(null)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true)
          obs.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <article className="bento-card bento-card--cdd" aria-labelledby="lp-bento-cdd-title">
      <div className="bc-stat">
        <div className="bc-stat-num">30j</div>
        <div className="bc-stat-label">avant échéance</div>
      </div>
      <div className="bc-icon" aria-hidden>
        <IconClock size={18} />
      </div>
      <h3 id="lp-bento-cdd-title" className="bc-title">
        Alertes CDD
      </h3>
      <p className="bc-desc">
        Notification automatique 30 jours avant l&apos;échéance d&apos;un contrat. Plus de surprises.
      </p>
      <div ref={chartRef} className="bc-cdd-chart" aria-hidden>
        {CDD_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="bc-cdd-bar"
            style={{
              flex: 1,
              borderRadius: '3px 3px 0 0',
              background: CDD_COLORS[i],
              height: animated ? `${h}%` : '0%',
              transition: `height 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.08}s`,
            }}
          />
        ))}
      </div>
    </article>
  )
}

function ImportCollaborateursCard() {
  return (
    <article className="bento-card bento-wide bento-card--import" aria-labelledby="lp-bento-import-title">
      <div className="bento-wide-inner">
        <div className="bento-wide-left">
          <div className="bc-icon" aria-hidden>
            <IconUsersPlus size={18} />
          </div>
          <h3 id="lp-bento-import-title" className="bc-title">
            Import collaborateurs
          </h3>
          <p className="bc-desc bc-desc--spaced">
            Excel ou CSV, avec création auto des départements et services. Validation inline, correction des erreurs,
            résolution organisationnelle automatique.
          </p>
          <span className="bc-badge bc-badge--teal">
            <IconCheck size={10} />
            1 800+ en une opération
          </span>
        </div>
        <div className="bento-wide-right">
          <div className="bw-mockup bento-mockup-delay">
            <div className="bw-mockup-chrome" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <div className="bw-import-row">
              <span className="bw-av bw-av-teal">AK</span>
              <span className="bw-name">Koné Aminata</span>
              <span className="bw-pill-ok">Créé</span>
            </div>
            <div className="bw-import-row">
              <span className="bw-av bw-av-orange">YD</span>
              <span className="bw-name">Diarra Yao</span>
              <span className="bw-pill-ok">Créé</span>
            </div>
            <div className="bw-import-row">
              <span className="bw-av bw-av-blue">BT</span>
              <span className="bw-name">Touré Bakary</span>
              <span className="bw-pill-ok">Créé</span>
            </div>
            <p className="bw-import-counter">+ 1 797 collaborateurs</p>
          </div>
        </div>
      </div>
    </article>
  )
}

function AuditCompletCard() {
  return (
    <article className="bento-card bento-card--audit" aria-labelledby="lp-bento-audit-title">
      <div className="bc-stat">
        <div className="bc-stat-num">100%</div>
        <div className="bc-stat-label">traçabilité</div>
      </div>
      <div className="bc-icon" aria-hidden>
        <IconBook size={18} />
      </div>
      <h3 id="lp-bento-audit-title" className="bc-title">
        Audit complet
      </h3>
      <p className="bc-desc">Chaque action est tracée : qui, quoi, quand. Export CSV en un clic.</p>
      <span className="bc-badge bc-badge--blue">
        <IconShield size={10} />
        Conforme RGPD
      </span>
    </article>
  )
}

function AppMobileCard() {
  return (
    <article className="bento-card bento-wide bento-card--mobile" aria-labelledby="lp-bento-mobile-title">
      <div className="bento-wide-inner">
        <div className="bento-wide-left">
          <div className="bc-icon" aria-hidden>
            <IconSmartphone size={18} />
          </div>
          <h3 id="lp-bento-mobile-title" className="bc-title">
            App mobile native
          </h3>
          <p className="bc-desc bc-desc--spaced">
            iOS et Android. PDF viewer intégré, téléchargement hors-ligne, notifications push. Chaque collaborateur
            consulte ses bulletins depuis son téléphone.
          </p>
          <span className="bc-badge bc-badge--green">
            <IconCheck size={10} />
            94% de taux de consultation
          </span>
        </div>
        <div className="bento-wide-right bw-phone-outer">
          <div className="bw-phone-frame bento-mockup-delay">
            <div className="bw-phone-notch" />
            <div className="bw-phone-line bw-phone-line-muted" />
            <div className="bw-phone-line bw-phone-line-green" />
            <div className="bw-phone-line bw-phone-line-green" />
            <div className="bw-phone-line bw-phone-line-muted" />
            <div className="bw-phone-line bw-phone-line-green" />
            <p className="bw-phone-caption">Bulletin de Mars</p>
          </div>
        </div>
      </div>
    </article>
  )
}

export function FeaturesGrid() {
  return (
    <section id="security" className="lp-features lp-features-section" aria-labelledby="lp-features-title">
      <div className="lp-container">
        <header className="lp-features-head">
          <Reveal>
            <p className="lp-fe-tag">
              <span className="lp-fe-tag-inner">Tout-en-un</span>
            </p>
          </Reveal>
          <Reveal delay={1}>
            <h2 id="lp-features-title" className="lp-fe-title">
              Pas juste un outil d&apos;envoi
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="lp-fe-lead">
              Une suite RH autour des bulletins : import, conformité, mobile et pilotage — dans une seule plateforme.
            </p>
          </Reveal>
        </header>

        <div className="bento-grid">
          <Reveal delay={0} className="bento-reveal bento-reveal-wide">
            <ImportCollaborateursCard />
          </Reveal>
          <Reveal delay={1} className="bento-reveal">
            <AlertesCddCard />
          </Reveal>
          <Reveal delay={2} className="bento-reveal">
            <AuditCompletCard />
          </Reveal>
          <Reveal delay={3} className="bento-reveal bento-reveal-wide">
            <AppMobileCard />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
