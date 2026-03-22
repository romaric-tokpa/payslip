import type { CSSProperties, ReactNode } from 'react'
import type { FormItemProps } from 'antd'
import type { Rule } from 'antd/es/form'
import { Form } from 'antd'

const requiredAsteriskStyle: CSSProperties = {
  color: '#ff4d4f',
  marginLeft: 2,
  fontFamily: 'SimSun, sans-serif',
  lineHeight: 1,
}

export type AuthFormFieldProps = {
  label: string
  name: string
  rules?: Rule[]
  children: ReactNode
  /** Affiche un astérisque rouge après le libellé (ex. NOM*). */
  requiredMark?: boolean
  optional?: boolean
  /** Réévalue les règles quand ces champs changent (ex. confirmation de mot de passe). */
  dependencies?: FormItemProps['dependencies']
  style?: CSSProperties
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#7f8c8d',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  marginBottom: 6,
}

export function AuthFormField({
  label,
  name,
  rules,
  children,
  requiredMark,
  optional,
  dependencies,
  style,
}: AuthFormFieldProps) {
  return (
    <div style={{ marginBottom: 18, ...style }}>
      <label style={labelStyle}>
        {label}
        {requiredMark ? (
          <span style={requiredAsteriskStyle} aria-hidden="true">
            *
          </span>
        ) : null}
        {optional ? (
          <span style={{ fontSize: 9, color: '#bdc3c7', marginLeft: 6 }}>
            (optionnel)
          </span>
        ) : null}
      </label>
      <Form.Item
        name={name}
        rules={rules}
        dependencies={dependencies}
        style={{ marginBottom: 0 }}
      >
        {children}
      </Form.Item>
    </div>
  )
}
