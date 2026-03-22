const companies = [
  'CFAO Motors',
  'Bolloré Transport',
  'Orange CI',
  'NSIA Assurances',
  'Ecobank CI',
  'Société Générale CI',
  'Solibra',
  'CIE',
] as const

export function TrustTicker() {
  const items = [...companies, ...companies]

  return (
    <section className="trust-ticker" aria-label="Ils nous font confiance">
      <div className="lp-container">
        <div className="trust-inner">
        <div className="trust-label">+200 ENTREPRISES</div>
        <div className="trust-divider" aria-hidden />
        <div className="trust-scroll">
          <div className="trust-track">
            {items.map((name, i) => (
              <div className="trust-item" key={`${name}-${i}`}>
                <div
                  className="trust-dot"
                  style={{
                    background: i % 2 === 0 ? 'rgba(242, 140, 40, 0.45)' : 'rgba(93, 202, 165, 0.45)',
                  }}
                />
                <span className="trust-name">{name}</span>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    </section>
  )
}
