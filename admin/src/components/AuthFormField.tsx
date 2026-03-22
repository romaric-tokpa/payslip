import type { CSSProperties, ReactNode } from 'react'
import type { Rule } from 'antd/es/form'
import { Form } from 'antd'

export type AuthFormFieldProps = {
  label: string
  name: string
  rules?: Rule[]
  children: ReactNode
  optional?: boolean
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
  optional,
  style,
}: AuthFormFieldProps) {
  return (
    <div style={{ marginBottom: 18, ...style }}>
      <label style={labelStyle}>
        {label}
        {optional ? (
          <span style={{ fontSize: 9, color: '#bdc3c7', marginLeft: 6 }}>
            (optionnel)
          </span>
        ) : null}
      </label>
      <Form.Item name={name} rules={rules} style={{ marginBottom: 0 }}>
        {children}
      </Form.Item>
    </div>
  )
}
