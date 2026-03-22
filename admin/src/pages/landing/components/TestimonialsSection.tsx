import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusEvent, TouchEvent } from 'react'
import { Reveal } from './Reveal'
import { IconCheck } from './icons'

const TESTIMONIALS = [
  {
    quote:
      "Avant PaySlip Manager, je passais 2 jours chaque mois à envoyer les bulletins. Maintenant je dépose les PDFs, je vérifie, et 10 minutes plus tard tout le monde a son bulletin sur son téléphone.",
    name: 'Aminata Koné',
    role: 'DRH — Société Industrielle CI — 450 collaborateurs',
    initials: 'AK',
    metricText: '2 jours gagnés / mois',
    accent: 'teal' as const,
  },
  {
    quote:
      "L'import intelligent a été le déclencheur. On a importé 1 200 collaborateurs avec départements et services en une seule opération. L'équipe RH n'en revenait pas.",
    name: 'Yao Diarra',
    role: 'Resp. Paie — Groupe BTP — 1 200 collaborateurs',
    initials: 'YD',
    metricText: '1 200 importés en 1 opération',
    accent: 'orange' as const,
  },
  {
    quote:
      "Les alertes CDD nous ont évité 3 oublis de renouvellement ce trimestre. Le dashboard est clair, les stats sont là. On ne revient pas en arrière.",
    name: 'Saran Keita',
    role: 'RRH — Cabinet conseil RH — 180 collaborateurs',
    initials: 'SK',
    metricText: '3 oublis évités ce trimestre',
    accent: 'blue' as const,
  },
] as const

type TestimonialItem = (typeof TESTIMONIALS)[number]

function TestimonialSlide({ t, active }: { t: TestimonialItem; active: boolean }) {
  return (
    <blockquote
      className={`testimonial-slide testimonial-slide--accent-${t.accent}`}
      aria-hidden={!active}
    >
      <div className="testimonial-slide-inner">
        <div className="testimonial-slide-accent" aria-hidden />
        <div className="testimonial-slide-main">
          <span className="tc-quote-mark" aria-hidden>
            &ldquo;
          </span>
          <div className="tc-body">
            <p className="tc-quote">{t.quote}</p>
            <footer className="tc-author-block">
              <div className="tc-author">
                <span className="tc-author-avatar">{t.initials}</span>
                <div>
                  <div className="tc-author-name">{t.name}</div>
                  <div className="tc-author-role">{t.role}</div>
                </div>
              </div>
              <div className={`tc-metric tc-metric--${t.accent}`}>
                <span className="tc-metric-icon" aria-hidden>
                  <IconCheck size={12} />
                </span>
                {t.metricText}
              </div>
            </footer>
          </div>
        </div>
      </div>
    </blockquote>
  )
}

export function TestimonialsSection() {
  const totalSlides = TESTIMONIALS.length
  const [current, setCurrent] = useState(0)
  const [inView, setInView] = useState(false)
  const [stepPx, setStepPx] = useState(0)
  const autoplayRef = useRef<number | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef(0)
  const touchEnd = useRef(0)

  const goTo = useCallback((index: number) => {
    setCurrent(((index % totalSlides) + totalSlides) % totalSlides)
  }, [totalSlides])

  const next = useCallback(() => {
    setCurrent((c) => ((c + 1) % totalSlides + totalSlides) % totalSlides)
  }, [totalSlides])

  const prev = useCallback(() => {
    setCurrent((c) => ((c - 1) % totalSlides + totalSlides) % totalSlides)
  }, [totalSlides])

  const pauseAutoplay = useCallback(() => {
    if (autoplayRef.current !== null) {
      clearInterval(autoplayRef.current)
      autoplayRef.current = null
    }
  }, [])

  const resumeAutoplay = useCallback(() => {
    if (autoplayRef.current !== null) clearInterval(autoplayRef.current)
    autoplayRef.current = window.setInterval(() => {
      setCurrent((c) => ((c + 1) % totalSlides + totalSlides) % totalSlides)
    }, 6000)
  }, [totalSlides])

  const resumeIfNoFocusInside = useCallback(() => {
    const root = carouselRef.current
    if (root?.contains(document.activeElement)) return
    resumeAutoplay()
  }, [resumeAutoplay])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const el = sliderRef.current
    if (!el) return
    const measure = () => setStepPx(el.clientWidth + 24)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    resumeAutoplay()
    return () => {
      pauseAutoplay()
    }
  }, [inView, pauseAutoplay, resumeAutoplay])

  const handleTouchStart = (e: TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientX
    pauseAutoplay()
  }

  const handleTouchMove = (e: TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const endX = e.changedTouches[0]?.clientX ?? touchEnd.current
    const diff = touchStart.current - endX
    if (Math.abs(diff) > 50) {
      if (diff > 0) next()
      else prev()
    }
    resumeAutoplay()
  }

  const handleCarouselBlur = (e: FocusEvent<HTMLDivElement>) => {
    const nextFocus = e.relatedTarget as Node | null
    if (!e.currentTarget.contains(nextFocus)) {
      resumeAutoplay()
    }
  }

  const trackTransform =
    stepPx > 0 ? `translateX(-${current * stepPx}px)` : 'translateX(0)'

  const active = TESTIMONIALS[current]

  return (
    <section
      ref={sectionRef}
      id="about"
      className="lp-testimonials lp-testimonials-section"
      aria-labelledby="lp-testimonials-heading"
    >
      <div className="lp-container">
        <header className="lp-testimonials-head">
          <Reveal delay={0}>
            <p className="lp-ts-tag">
              <span className="lp-ts-tag-inner">Témoignages</span>
            </p>
          </Reveal>
          <Reveal delay={1}>
            <h2 id="lp-testimonials-heading" className="lp-ts-title">
              Ce qu&apos;en disent nos clients
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="lp-ts-lead">
              Des équipes RH qui ont transformé leur routine paie — en vrai, en chiffres.
            </p>
          </Reveal>
        </header>

        <Reveal delay={1}>
          <div
            ref={carouselRef}
            className="lp-testi-carousel"
            onMouseEnter={pauseAutoplay}
            onMouseLeave={resumeIfNoFocusInside}
            onFocusCapture={pauseAutoplay}
            onBlurCapture={handleCarouselBlur}
          >
            <div className="testimonial-slider-shell">
              <button type="button" className="testimonial-arrow testimonial-arrow--prev" onClick={prev} aria-label="Témoignage précédent">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>

              <div
                ref={sliderRef}
                className="testimonial-slider"
                role="region"
                aria-label="Témoignages clients"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  className="testimonial-track"
                  style={{ transform: trackTransform }}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p className="lp-testi-live">
                    Témoignage {current + 1} sur {totalSlides}. {active.name}, {active.role}. {active.quote}
                  </p>
                  {TESTIMONIALS.map((t, i) => (
                    <TestimonialSlide key={i} t={t} active={i === current} />
                  ))}
                </div>
              </div>

              <button type="button" className="testimonial-arrow testimonial-arrow--next" onClick={next} aria-label="Témoignage suivant">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="testimonial-nav-bottom">
              <div className="testimonial-dots" aria-label="Choisir un témoignage">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`testimonial-dot ${i === current ? 'active' : ''}`}
                    onClick={() => goTo(i)}
                    aria-label={`Témoignage ${i + 1}`}
                    aria-current={i === current ? 'step' : undefined}
                  />
                ))}
              </div>
              <p className="testimonial-counter" aria-hidden>
                {current + 1} / {totalSlides}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
