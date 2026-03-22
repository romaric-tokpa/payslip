import { Badge, Input, Tooltip } from 'antd'
import type { ValidationError } from '../../../types/employees'

export type EditableCellProps = {
  value: string
  field: string
  errors: ValidationError[]
  onChange: (field: string, newValue: string) => void
  editable: boolean
  originalValue: string
}

export function EditableCell({
  value,
  field,
  errors,
  onChange,
  editable,
  originalValue,
}: EditableCellProps) {
  const fieldErrors = errors.filter((e) => e.field === field)
  const firstMsg = fieldErrors[0]?.message
  const suggestion = fieldErrors[0]?.suggestion
  const modified = value !== originalValue

  if (editable && fieldErrors.length > 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Tooltip title={firstMsg}>
          <Input
            size="small"
            value={value}
            placeholder={suggestion}
            onChange={(e) => onChange(field, e.target.value)}
            status="error"
            style={{
              fontSize: 11,
              maxWidth: 200,
              background: '#FDF5F5',
              borderColor: '#E74C3C',
            }}
          />
        </Tooltip>
        {modified ? (
          <Badge
            count="modifié"
            style={{ backgroundColor: '#2980B9', fontSize: 9 }}
          />
        ) : null}
      </div>
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 600 }}>{value || '—'}</span>
      {modified ? (
        <Badge
          count="modifié"
          style={{ backgroundColor: '#2980B9', fontSize: 9 }}
        />
      ) : null}
    </span>
  )
}
