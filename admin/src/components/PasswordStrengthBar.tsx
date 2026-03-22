import './password-strength-bar.css'

export type PasswordStrengthBarProps = {
  password: string
}

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4

export function getPasswordStrengthScore(password: string): PasswordStrengthScore {
  if (password.length === 0) {
    return 0
  }
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  if (password.length < 8) {
    return 1
  }
  if (!hasUpper || !hasDigit) {
    if (hasUpper || hasDigit) {
      return 2
    }
    return 1
  }
  if (!hasSpecial) {
    return 3
  }
  return 4
}

function barColor(score: PasswordStrengthScore, index: number): string {
  if (score === 0 || index >= score) {
    return '#e8e8e8'
  }
  if (score === 1) {
    return '#e74c3c'
  }
  if (score === 2 || score === 3) {
    return '#f28c28'
  }
  return '#27ae60'
}

function labelAndHint(score: PasswordStrengthScore): {
  label: string
  hint: string
  color: string
} {
  switch (score) {
    case 0:
      return { label: '', hint: '', color: '#7f8c8d' }
    case 1:
      return {
        label: 'Faible',
        hint: ' — au moins 8 caractères requis',
        color: '#e74c3c',
      }
    case 2:
      return {
        label: 'Moyen',
        hint: ' — ajoutez un caractère spécial',
        color: '#f28c28',
      }
    case 3:
      return {
        label: 'Bon',
        hint: ' — ajoutez un caractère spécial pour renforcer',
        color: '#f28c28',
      }
    case 4:
      return { label: 'Fort', hint: '', color: '#27ae60' }
    default:
      return { label: '', hint: '', color: '#7f8c8d' }
  }
}

export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  const score = getPasswordStrengthScore(password)
  const { label, hint, color } = labelAndHint(score)

  return (
    <div className="password-strength-bar">
      <div className="password-strength-bar__segments">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={String(i)}
            className="password-strength-bar__segment"
            style={{ backgroundColor: barColor(score, i) }}
          />
        ))}
      </div>
      {score > 0 ? (
        <p className="password-strength-bar__caption" style={{ color }}>
          <span style={{ fontWeight: 600 }}>{label}</span>
          <span>{hint}</span>
        </p>
      ) : null}
    </div>
  )
}
