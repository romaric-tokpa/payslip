import type { FormEvent } from 'react'
import {
  LANDING_APP_STORE_URL,
  LANDING_BADGE_APP_STORE,
  LANDING_BADGE_GOOGLE_PLAY,
  LANDING_GOOGLE_PLAY_URL,
  LANDING_LOGO_HORIZONTAL_DARK,
  scrollToSection,
} from '../constants'
import { IconLinkedIn, IconTwitter } from './icons'

export function Footer() {
  const link = (id: string) => () => scrollToSection(id)

  const onNewsletter = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
  }

  return (
    <footer className="lp-footer" role="contentinfo">
      <div className="lp-footer-accent" aria-hidden />
      <div className="lp-container">
        <div className="lp-footer-inner">
          <div className="footer-shell">
            <div className="footer-head">
              <div className="footer-head-brand">
                <span className="footer-logo">
                  <img
                    src={LANDING_LOGO_HORIZONTAL_DARK}
                    alt="PaySlip Manager"
                    width={360}
                    height={141}
                    decoding="async"
                  />
                </span>
                <p className="footer-tagline">Bulletins de paie, distribués en toute confiance</p>
                <p className="footer-desc">
                  La plateforme de distribution sécurisée des bulletins de paie pour les entreprises en Afrique de
                  l&apos;Ouest.
                </p>
                <div className="footer-stores">
                  <p className="footer-stores-label">Télécharger l&apos;application</p>
                  <div className="footer-stores-row">
                    <a
                      href={LANDING_APP_STORE_URL}
                      className="footer-store-badge"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={LANDING_BADGE_APP_STORE}
                        alt="Télécharger dans l’App Store"
                        width={180}
                        height={54}
                        decoding="async"
                      />
                    </a>
                    <a
                      href={LANDING_GOOGLE_PLAY_URL}
                      className="footer-store-badge"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={LANDING_BADGE_GOOGLE_PLAY}
                        alt="Disponible sur Google Play"
                        width={200}
                        height={54}
                        decoding="async"
                      />
                    </a>
                  </div>
                </div>
              </div>

              <div className="footer-head-cta">
                <h3 className="footer-newsletter-heading">Newsletter</h3>
                <p className="footer-newsletter-lead">
                  Conseils RH, nouveautés produit — pas plus d&apos;un e-mail par mois.
                </p>
                <form className="footer-newsletter" onSubmit={onNewsletter}>
                  <div className="footer-newsletter-field">
                    <input
                      type="email"
                      name="email"
                      className="footer-newsletter-input"
                      placeholder="votre@email.com"
                      autoComplete="email"
                      aria-label="Adresse e-mail pour la newsletter"
                    />
                    <button type="submit" className="footer-newsletter-btn">
                      S&apos;abonner
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <nav className="footer-mid" aria-label="Liens du pied de page">
              <div className="footer-mid-col">
                <h4 className="footer-col-title">Produit</h4>
                <div className="footer-links">
                  <button type="button" onClick={link('product')}>
                    Fonctionnalités
                  </button>
                  <button type="button" onClick={link('pricing')}>
                    Tarifs
                  </button>
                  <button type="button" onClick={link('security')}>
                    Sécurité
                  </button>
                </div>
              </div>

              <div className="footer-mid-col">
                <h4 className="footer-col-title">Support</h4>
                <div className="footer-links">
                  <button type="button" onClick={link('contact')}>
                    Contact
                  </button>
                  <button type="button" onClick={link('about')}>
                    À propos
                  </button>
                  <button type="button" onClick={link('contact')}>
                    FAQ
                  </button>
                </div>
              </div>

              <div className="footer-mid-col">
                <h4 className="footer-col-title">Légal</h4>
                <div className="footer-links">
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    Mentions légales
                  </a>
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    Confidentialité
                  </a>
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    CGU
                  </a>
                </div>
              </div>
            </nav>

            <div className="footer-bar">
              <div className="footer-social-row">
                <div className="footer-social">
                  <a href="#" className="footer-social-btn" aria-label="LinkedIn" onClick={(e) => e.preventDefault()}>
                    <IconLinkedIn size={16} />
                  </a>
                  <a href="#" className="footer-social-btn" aria-label="X" onClick={(e) => e.preventDefault()}>
                    <IconTwitter size={16} />
                  </a>
                </div>
              </div>
              <p className="footer-copy">© 2026 PaySlip Manager</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
