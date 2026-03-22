import {
  ArrowRightOutlined,
  CheckOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { Select } from 'antd'
import type {
  OrgResolutionAction,
  OrgResolutionDecision,
  OrgResolutionItem,
} from '../../../types/org'

const chipBase: React.CSSProperties = {
  border: 'none',
  borderRadius: 4,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
}

export type OrgResolutionItemRowProps = {
  item: OrgResolutionItem
  decision: OrgResolutionDecision
  onChange: (decision: OrgResolutionDecision) => void
  existingEntities: { id: string; name: string }[]
  parentEntities?: { id: string; name: string; isNew?: boolean }[]
  parentLabel?: string
  parentAutoDetected?: boolean
  parentInvalidReason?: string
}

function ActionChip({
  label,
  selected,
  variant,
  onClick,
}: {
  label: string
  selected: boolean
  variant: 'create' | 'associate' | 'ignore'
  onClick: () => void
}) {
  const styles: Record<string, React.CSSProperties> = {
    create: selected
      ? { background: '#0F5C5E', color: '#fff' }
      : { background: '#F4F6F6', color: '#7F8C8D' },
    associate: selected
      ? {
          background: '#EBF5FB',
          border: '1px solid #2980B9',
          color: '#2980B9',
        }
      : { background: '#F4F6F6', color: '#7F8C8D' },
    ignore: selected
      ? { background: '#F4F6F6', color: '#7F8C8D' }
      : { background: '#F4F6F6', color: '#BDC3C7' },
  }
  return (
    <button
      type="button"
      style={{ ...chipBase, ...styles[variant] }}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function OrgResolutionItemRow({
  item,
  decision,
  onChange,
  existingEntities,
  parentEntities,
  parentLabel,
  parentAutoDetected,
  parentInvalidReason,
}: OrgResolutionItemRowProps) {
  if (item.status === 'existing') {
    return (
      <div
        style={{
          background: '#EAFAF1',
          borderRadius: 8,
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckOutlined style={{ color: '#52c41a', fontSize: 15 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#52c41a' }}>
            {item.existingName ?? item.value}
          </span>
          <span style={{ fontSize: 12, color: '#95a5a6' }}>
            ({item.lineCount} lignes)
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#52c41a',
            background: 'rgba(82,196,26,0.12)',
            padding: '3px 8px',
            borderRadius: 4,
          }}
        >
          Existant
        </span>
      </div>
    )
  }

  const setAction = (action: OrgResolutionAction) => {
    if (action === 'associate') {
      onChange({
        ...decision,
        action: 'associate',
        associateToId:
          item.status === 'similar'
            ? (item.suggestedId ?? decision.associateToId)
            : decision.associateToId ?? existingEntities[0]?.id,
      })
      return
    }
    if (action === 'create') {
      onChange({
        ...decision,
        action: 'create',
        associateToId: undefined,
        parentId: item.suggestedParentId ?? decision.parentId,
        parentName: item.suggestedParentName ?? decision.parentName,
      })
      return
    }
    onChange({
      ...decision,
      action: 'ignore',
      associateToId: undefined,
      parentId: undefined,
      parentName: undefined,
    })
  }

  const ignored = decision.action === 'ignore'
  const similar = item.status === 'similar'

  return (
    <div
      style={{
        background: '#fff',
        border: ignored ? '1.5px solid #BDC3C7' : '1.5px solid #F28C28',
        borderRadius: 8,
        padding: '8px 10px',
        opacity: ignored ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            background: '#FEF3E5',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: '#F28C28',
          }}
        >
          <PlusOutlined style={{ fontSize: 12 }} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#F28C28' }}>
          {item.value}
        </span>
        <span style={{ fontSize: 12, color: '#95a5a6' }}>
          ({item.lineCount} lignes)
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        <ActionChip
          label="Créer"
          variant="create"
          selected={decision.action === 'create'}
          onClick={() => setAction('create')}
        />
        <ActionChip
          label="Associer à…"
          variant="associate"
          selected={decision.action === 'associate'}
          onClick={() => setAction('associate')}
        />
        <ActionChip
          label="Ignorer"
          variant="ignore"
          selected={decision.action === 'ignore'}
          onClick={() => setAction('ignore')}
        />
      </div>

      {decision.action === 'create' && parentEntities && parentLabel ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 4,
          }}
        >
          <span style={{ fontSize: 12, color: '#2980B9' }}>{parentLabel} :</span>
          <Select
            size="middle"
            allowClear
            style={{
              minWidth: 160,
              fontSize: 13,
            }}
            placeholder="Aucun / Choisir…"
            value={decision.parentId}
            options={parentEntities.map((p) => ({
              value: p.id,
              label: p.isNew ? `${p.name} (sera créé)` : p.name,
            }))}
            onChange={(id) => {
              const hit = parentEntities.find((p) => p.id === id)
              onChange({
                ...decision,
                parentId: id,
                parentName: hit?.name,
              })
            }}
            showSearch
            optionFilterProp="label"
          />
          {parentAutoDetected ? (
            <span style={{ fontSize: 12, color: '#95a5a6' }}>
              (auto-détecté)
            </span>
          ) : null}
        </div>
      ) : null}

      {decision.action === 'associate' ? (
        <div
          style={{
            marginTop: 4,
            background: '#EBF5FB',
            borderRadius: 6,
            padding: '6px 8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {similar ? (
              <ArrowRightOutlined style={{ color: '#2980B9', fontSize: 14 }} />
            ) : null}
            <Select
              size="middle"
              style={{ flex: 1, minWidth: 140, fontSize: 13 }}
              value={decision.associateToId}
              options={existingEntities.map((e) => ({
                value: e.id,
                label: e.name,
              }))}
              onChange={(id) =>
                onChange({
                  ...decision,
                  associateToId: id,
                })
              }
              showSearch
              optionFilterProp="label"
            />
          </div>
          {similar ? (
            <div style={{ fontSize: 12, color: '#95a5a6', marginTop: 4 }}>
              (match similaire détecté)
            </div>
          ) : null}
        </div>
      ) : null}

      {similar && decision.action === 'create' ? (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: '#95a5a6',
          }}
        >
          Suggestion : « {item.suggestedName} » — vous créez une entité distincte.
        </div>
      ) : null}

      {parentInvalidReason ? (
        <div style={{ color: '#E74C3C', fontSize: 12, marginTop: 6 }}>
          {parentInvalidReason}
        </div>
      ) : null}
    </div>
  )
}
