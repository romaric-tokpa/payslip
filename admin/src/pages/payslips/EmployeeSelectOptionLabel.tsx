import { Avatar } from 'antd'
import type { ReactNode } from 'react'
import type { EmployeeUser } from '../../types/employees'
import { formatEmployeeOption } from './payslipUploadConstants'

export function employeeInitialsFromUser(u: EmployeeUser): string {
  const a = u.firstName?.trim()?.[0]
  const b = u.lastName?.trim()?.[0]
  return `${a ?? ''}${b ?? ''}`.toUpperCase() || '?'
}

/** Initiales dérivées d’un libellé « MAT — Nom Prénom » (preset bulk sans fiche User). */
export function initialsFromPresetLabel(text: string): string {
  const after = text.includes('—') ? (text.split('—')[1] ?? text).trim() : text.trim()
  const words = after.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return `${words[0][0] ?? ''}${words[words.length - 1][0] ?? ''}`.toUpperCase()
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return words[0]?.[0]?.toUpperCase() ?? '?'
}

export function EmployeeSelectOptionLabel({ user }: { user: EmployeeUser }): ReactNode {
  const url = user.profilePhotoUrl?.trim()
  return (
    <span className="payslip-upload-employee-option">
      <Avatar
        size={36}
        src={url || undefined}
        className="payslip-upload-employee-avatar"
        style={{ flexShrink: 0, backgroundColor: '#0f5c5e' }}
      >
        {employeeInitialsFromUser(user)}
      </Avatar>
      <span className="payslip-upload-employee-option-text">
        {formatEmployeeOption(user)}
      </span>
    </span>
  )
}

export function EmployeeSelectPresetLabel({ text }: { text: string }): ReactNode {
  return (
    <span className="payslip-upload-employee-option">
      <Avatar
        size={36}
        className="payslip-upload-employee-avatar"
        style={{ flexShrink: 0, backgroundColor: '#0f5c5e' }}
      >
        {initialsFromPresetLabel(text)}
      </Avatar>
      <span className="payslip-upload-employee-option-text">{text}</span>
    </span>
  )
}
