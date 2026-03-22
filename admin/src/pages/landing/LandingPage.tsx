import BeforeAfterSection from './components/BeforeAfterSection'
import { Navbar } from './components/Navbar'
import { HeroSection } from './components/HeroSection'
import { TrustTicker } from './components/TrustTicker'
import { HowItWorksSection } from './components/HowItWorksSection'
import { FeaturesGrid } from './components/FeaturesGrid'
import { PricingSection } from './components/PricingSection'
import { TestimonialsSection } from './components/TestimonialsSection'
import { CtaSection } from './components/CtaSection'
import { Footer } from './components/Footer'
import './landing.css'

export function LandingPage() {
  return (
    <div className="lp-v2" id="lp-top" lang="fr">
      <a href="#lp-main" className="lp-skip-link">
        Aller au contenu principal
      </a>
      <Navbar />
      <main id="lp-main" className="lp-main" tabIndex={-1}>
        <div className="lp-stack">
          <div className="lp-teal-hero-block">
            <div className="lp-stack-item">
              <HeroSection />
            </div>
            <div className="lp-stack-item">
              <TrustTicker />
            </div>
            <div className="lp-stack-item">
              <BeforeAfterSection />
            </div>
          </div>
          <div className="lp-stack-item">
            <HowItWorksSection />
          </div>
          <div className="lp-stack-item">
            <FeaturesGrid />
          </div>
          <div className="lp-stack-item">
            <PricingSection />
          </div>
          <div className="lp-stack-item">
            <TestimonialsSection />
          </div>
          <div className="lp-stack-item">
            <CtaSection />
          </div>
          <div className="lp-stack-item">
            <Footer />
          </div>
        </div>
      </main>
    </div>
  )
}
