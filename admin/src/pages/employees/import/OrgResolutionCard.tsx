import { Input } from 'antd'
import { useMemo, useState } from 'react'
import type {
  OrgResolutionDecision,
  OrgResolutionItem,
} from '../../../types/org'
import { OrgResolutionItemRow } from './OrgResolutionItemRow'

export type OrgResolutionCardProps = {
  decisionPrefix: 'dir' | 'dept' | 'svc'
  title: string
  color: string
  items: OrgResolutionItem[]
  decisions: Record<string, OrgResolutionDecision>
  onDecisionChange: (key: string, decision: OrgResolutionDecision) => void
  existingEntities: { id: string; name: string }[]
  parentEntities?: { id: string; name: string; isNew?: boolean }[]
  parentLabel?: string
  parentAutoByItemKey?: Record<string, boolean>
  parentInvalidByItemKey?: Record<string, string | undefined>
}

export function decisionStorageKey(
  prefix: OrgResolutionCardProps['decisionPrefix'],
  normalizedValue: string,
): string {
  return `${prefix}_${normalizedValue}`
}

export function OrgResolutionCard({
  decisionPrefix,
  title,
  color,
  items,
  decisions,
  onDecisionChange,
  existingEntities,
  parentEntities,
  parentLabel,
  parentAutoByItemKey,
  parentInvalidByItemKey,
}: OrgResolutionCardProps) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) {
      return items
    }
    return items.filter((it) => it.value.toLowerCase().includes(t))
  }, [items, q])

  const existingN = items.filter((i) => i.status === 'existing').length
  const newN = items.filter((i) => i.status !== 'existing').length

  return (
    <div
      style={{
        borderRadius: 10,
        border: '0.5px solid #E8E8E8',
        padding: 14,
        background: '#fff',
        minHeight: 120,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: color,
            }}
          />
          <span style={{ fontSize: 15, fontWeight: 500 }}>{title}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span
            style={{
              fontSize: 12,
              background: 'rgba(82,196,26,0.12)',
              color: '#389e0d',
              padding: '3px 8px',
              borderRadius: 4,
            }}
          >
            {existingN} existants
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              background: '#FEF3E5',
              color: '#F28C28',
              padding: '3px 8px',
              borderRadius: 4,
            }}
          >
            {newN} nouveaux
          </span>
        </div>
      </div>

      {items.length > 10 ? (
        <Input.Search
          allowClear
          size="middle"
          placeholder="Rechercher…"
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: 8, fontSize: 14 }}
        />
      ) : null}

      <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((item) => {
          const key = decisionStorageKey(decisionPrefix, item.normalizedValue)
          const dec =
            decisions[key] ??
            ({
              value: item.value,
              action: 'create',
            } as OrgResolutionDecision)
          return (
            <OrgResolutionItemRow
              key={key}
              item={item}
              decision={dec}
              onChange={(next) => onDecisionChange(key, next)}
              existingEntities={existingEntities}
              parentEntities={parentEntities}
              parentLabel={parentLabel}
              parentAutoDetected={parentAutoByItemKey?.[key]}
              parentInvalidReason={parentInvalidByItemKey?.[key]}
            />
          )
        })}
      </div>
    </div>
  )
}
