import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LANDING_LOGO_HORIZONTAL,
  LANDING_LOGO_HORIZONTAL_DARK,
  scrollToSection,
  scrollToTop,
} from '../constants'

export function Navbar() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const go = (id: string) => {
    scrollToSection(id)
    setMenuOpen(false)
  }

  return (
    <>
      <header className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <div className="lp-nav-start">
            <button type="button" className="lp-nav-brand" onClick={() => scrollToTop()} aria-label="Accueil">
              <span className="lp-nav-logo">
                <img
                  src={LANDING_LOGO_HORIZONTAL_DARK}
                  alt="PaySlip Manager"
                  width={280}
                  height={110}
                  decoding="async"
                />
              </span>
            </button>
          </div>

          <nav className="lp-nav-links" aria-label="Navigation principale">
            <div className="lp-nav-pill" role="presentation">
              <button type="button" className="lp-nav-link" onClick={() => go('product')}>
                Produit
              </button>
              <button type="button" className="lp-nav-link" onClick={() => go('pricing')}>
                Tarifs
              </button>
              <button type="button" className="lp-nav-link" onClick={() => go('about')}>
                À propos
              </button>
            </div>
          </nav>

          <div className="lp-nav-end">
            <div className="lp-nav-actions">
              <button type="button" className="lp-nav-login" onClick={() => navigate('/login')}>
                Connexion
              </button>
              <button type="button" className="lp-nav-cta btn-glow" onClick={() => navigate('/register')}>
                Démarrer
              </button>
              <button
                type="button"
                className="lp-hamburger"
                aria-expanded={menuOpen}
                aria-controls="lp-nav-drawer"
                aria-label="Menu"
                onClick={() => setMenuOpen(true)}
              >
                <span />
                <span />
                <span />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`lp-drawer-overlay ${menuOpen ? 'open' : ''}`}
        role="presentation"
        onClick={() => setMenuOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setMenuOpen(false)}
      />
      <div
        id="lp-nav-drawer"
        className={`lp-drawer ${menuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="lp-drawer-top">
          <div className="lp-drawer-brand">
            <img src={LANDING_LOGO_HORIZONTAL} alt="" width={280} height={110} decoding="async" />
          </div>
          <button type="button" className="lp-drawer-close" onClick={() => setMenuOpen(false)} aria-label="Fermer">
            <span aria-hidden className="lp-drawer-close-x">
              ×
            </span>
          </button>
        </div>

        <nav className="lp-drawer-nav" aria-label="Menu mobile">
          <button type="button" className="lp-drawer-link" onClick={() => go('product')}>
            Produit
          </button>
          <button type="button" className="lp-drawer-link" onClick={() => go('pricing')}>
            Tarifs
          </button>
          <button type="button" className="lp-drawer-link" onClick={() => go('about')}>
            À propos
          </button>
        </nav>

        <div className="lp-drawer-actions">
          <button type="button" className="lp-drawer-login" onClick={() => { setMenuOpen(false); navigate('/login') }}>
            Connexion
          </button>
          <button
            type="button"
            className="lp-drawer-cta btn-glow"
            onClick={() => { setMenuOpen(false); navigate('/register') }}
          >
            Démarrer gratuitement
          </button>
        </div>
      </div>
    </>
  )
}
