import { useScrollReveal } from '../hooks/useScrollReveal'
import { Reveal } from './Reveal'
import { ZzContent } from './ZzContent'
import { ZzVisualNotify, ZzVisualTable, ZzVisualUpload } from './howZigzagVisuals'

export function HowItWorksSection() {
  const row1Ref = useScrollReveal<HTMLDivElement>()
  const row2Ref = useScrollReveal<HTMLDivElement>()
  const row3Ref = useScrollReveal<HTMLDivElement>()
  const divider1Ref = useScrollReveal<HTMLDivElement>()
  const divider2Ref = useScrollReveal<HTMLDivElement>()

  return (
    <section id="product" className="lp-how lp-how-section" aria-labelledby="lp-how-title">
      <div className="lp-container">
        <header className="lp-how-header">
          <Reveal>
            <p className="lp-how-tag">
              <span className="lp-how-tag-inner">Comment ça marche</span>
            </p>
          </Reveal>
          <Reveal delay={1}>
            <h2 id="lp-how-title" className="lp-how-title">
              Trois étapes. Zéro friction.
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="lp-how-lead">
              Import en masse, contrôle en un coup d&apos;œil, distribution instantanée — sans changer vos habitudes.
            </p>
          </Reveal>
        </header>

        <div className="how-zigzag lp-how-track">
          <article
            ref={row1Ref}
            className="zz-row lp-how-step"
            aria-labelledby="lp-how-step-1"
          >
            <ZzVisualUpload />
            <div className="zz-content">
              <ZzContent
                stepNumber={1}
                stepLabel="Étape 1"
                stepColor="teal"
                stepBgColor="#E8F5F5"
                stepTextColor="#0F5C5E"
                title="Déposez vos bulletins"
                description="Glissez tous vos PDFs d&apos;un coup. Le système lit chaque fichier et identifie le collaborateur par matricule, nom ou structure du document."
                badgeVariant="circle"
              />
            </div>
          </article>

          <div ref={divider1Ref} className="zz-divider lp-how-connector" aria-hidden>
            <span className="lp-how-connector-line" />
            <span className="lp-how-connector-node">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </span>
            <span className="lp-how-connector-line" />
          </div>

          <article
            ref={row2Ref}
            className="zz-row zz-row-reverse lp-how-step"
            aria-labelledby="lp-how-step-2"
          >
            <ZzVisualTable />
            <div className="zz-content">
              <ZzContent
                stepNumber={2}
                stepLabel="Étape 2"
                stepColor="orange"
                stepBgColor="#FEF3E5"
                stepTextColor="#854F0B"
                title="Vérifiez et corrigez"
                description="Un tableau interactif montre chaque bulletin avec son statut. Corrigez les erreurs inline, excluez les fichiers problématiques, validez en un clic."
                badgeVariant="circle"
              />
            </div>
          </article>

          <div ref={divider2Ref} className="zz-divider lp-how-connector" aria-hidden>
            <span className="lp-how-connector-line" />
            <span className="lp-how-connector-node">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </span>
            <span className="lp-how-connector-line" />
          </div>

          <article ref={row3Ref} className="zz-row lp-how-step" aria-labelledby="lp-how-step-3">
            <ZzVisualNotify />
            <div className="zz-content">
              <ZzContent
                stepNumber={3}
                stepLabel="Terminé"
                stepColor="green"
                stepBgColor="#EAFAF1"
                stepTextColor="#27500A"
                title="C&apos;est distribué"
                description="Notification push sur le téléphone de chaque collaborateur. PDF viewer intégré. Suivi de consultation en temps réel sur votre dashboard."
                badgeVariant="check"
              />
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
