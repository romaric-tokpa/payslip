import './password-checklist.css'

export type PasswordChecklistProps = {
  password: string
}

function CheckIcon({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <svg
        className="password-checklist__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#27ae60"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ opacity: ok ? 1 : 0.4 }}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }
  return (
    <svg
      className="password-checklist__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#d5d8dc"
      strokeWidth="1.5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const len8 = password.length >= 8
  const upperDigit = /[A-Z]/.test(password) && /[0-9]/.test(password)
  const special = /[^A-Za-z0-9]/.test(password)

  return (
    <div className="password-checklist">
      <div
        className={`password-checklist__row${len8 ? ' password-checklist__row--ok' : ''}`}
      >
        <CheckIcon ok={len8} />
        <span className="password-checklist__text">8 caractères minimum</span>
      </div>
      <div
        className={`password-checklist__row${upperDigit ? ' password-checklist__row--ok' : ''}`}
      >
        <CheckIcon ok={upperDigit} />
        <span className="password-checklist__text">1 majuscule et 1 chiffre</span>
      </div>
      <div
        className={`password-checklist__row${special ? ' password-checklist__row--ok' : ''}`}
      >
        <CheckIcon ok={special} />
        <span className="password-checklist__text">1 caractère spécial</span>
      </div>
    </div>
  )
}
