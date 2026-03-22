import { Card, Select, Tag } from 'antd'
import type { ImportFullNameSeparator } from '../../../types/employees'
import type { MappingTargetId } from './columnMatcher'
import type { MappingSelection } from './importMappingState'
import { countRequiredFieldsMapped } from './importMappingState'
import { splitFullNameValue } from './importTransform'
import type { RawImportRow } from './importTransform'
import './import-flow.css'

const SEP_OPTIONS: { value: ImportFullNameSeparator; label: string }[] = [
  { value: ' ', label: 'Espace' },
  { value: ',', label: 'Virgule' },
  { value: '-', label: 'Tiret' },
]

type RowDef = {
  id: MappingTargetId
  label: string
  requiredUnlessFullName: boolean
}

const ROWS: RowDef[] = [
  { id: 'matricule', label: 'Matricule', requiredUnlessFullName: true },
  { id: 'prenom', label: 'Prénom', requiredUnlessFullName: true },
  { id: 'nom', label: 'Nom', requiredUnlessFullName: true },
  { id: 'email', label: 'Email', requiredUnlessFullName: true },
  {
    id: 'direction',
    label: 'Direction',
    requiredUnlessFullName: false,
  },
  { id: 'departement', label: 'Département', requiredUnlessFullName: false },
  {
    id: 'service',
    label: 'Service',
    requiredUnlessFullName: false,
  },
  { id: 'poste', label: 'Poste', requiredUnlessFullName: false },
  {
    id: 'contractType',
    label: 'Type de contrat',
    requiredUnlessFullName: false,
  },
  {
    id: 'contractEndDate',
    label: 'Date fin de contrat',
    requiredUnlessFullName: false,
  },
  {
    id: 'entryDate',
    label: "Date d'entrée",
    requiredUnlessFullName: false,
  },
  {
    id: 'nomComplet',
    label: 'Nom complet',
    requiredUnlessFullName: false,
  },
]

type ColumnMappingStepProps = {
  headers: string[]
  sampleRows: RawImportRow[]
  value: MappingSelection
  onChange: (next: MappingSelection) => void
  suggestedSnapshot: MappingSelection
  useFullNameSplit: boolean
  onUseFullNameSplitChange: (v: boolean) => void
  fullNameSeparator: ImportFullNameSeparator
  onFullNameSeparatorChange: (v: ImportFullNameSeparator) => void
}

function isMapped(id: MappingTargetId, v: MappingSelection): boolean {
  const x = v[id]
  return x !== undefined && x !== ''
}

function isAutoMapped(
  id: MappingTargetId,
  value: MappingSelection,
  suggested: MappingSelection,
): boolean {
  const cur = value[id]
  const sug = suggested[id]
  return (
    cur !== undefined &&
    cur !== '' &&
    sug !== undefined &&
    sug !== '' &&
    cur === sug
  )
}

export function ColumnMappingStep({
  headers,
  sampleRows,
  value,
  onChange,
  suggestedSnapshot,
  useFullNameSplit,
  onUseFullNameSplitChange,
  fullNameSeparator,
  onFullNameSeparatorChange,
}: ColumnMappingStepProps) {
  const selectOptions = headers.map((h) => ({ value: h, label: h }))
  const fullCol = value.nomComplet
  const nameModeOk =
    (isMapped('nomComplet', value) && useFullNameSplit) ||
    (isMapped('prenom', value) && isMapped('nom', value))

  const usedHeaderSet = new Set<string>()
  for (const k of Object.keys(value) as (keyof MappingSelection)[]) {
    const col = value[k]
    if (typeof col === 'string' && col !== '') {
      usedHeaderSet.add(col)
    }
  }

  function setField(id: MappingTargetId, col: string | null) {
    const next = { ...value, [id]: col ?? undefined }
    if (id === 'nomComplet' && !col) {
      onUseFullNameSplitChange(false)
    }
    if (id === 'nomComplet' && col) {
      onUseFullNameSplitChange(true)
    }
    onChange(next)
  }

  const requiredCount = countRequiredFieldsMapped(value, useFullNameSplit)

  return (
    <div className="import-mapping-step">
      <div className="import-detected-tags" aria-label="Colonnes détectées">
        {headers.map((h) => {
          const used = usedHeaderSet.has(h)
          return (
            <Tag
              key={h}
              className={`import-detected-tag ${used ? 'import-detected-tag--used' : 'import-detected-tag--unused'}`}
            >
              {h}
            </Tag>
          )
        })}
      </div>

      <Card
        className="import-mapping-card"
        variant="outlined"
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '16px 20px 8px' }}>
          <div className="import-mapping-card-title">
            Associez vos colonnes aux champs PaySlip Manager
          </div>
        </div>
        <div style={{ padding: '0 20px 16px' }}>
          {ROWS.map((row) => {
            const mapped = isMapped(row.id, value)
            let ok = mapped
            if (row.id === 'prenom' || row.id === 'nom') {
              ok =
                mapped ||
                (isMapped('nomComplet', value) && useFullNameSplit)
            }
            if (row.id === 'nomComplet') {
              ok = !mapped || useFullNameSplit
            }
            const showRequired =
              row.requiredUnlessFullName &&
              row.id !== 'prenom' &&
              row.id !== 'nom'
            const showRequiredName =
              (row.id === 'prenom' || row.id === 'nom') && !nameModeOk

            const auto =
              mapped && isAutoMapped(row.id, value, suggestedSnapshot)
            const selectVariant = !mapped
              ? 'idle'
              : auto
                ? 'auto'
                : 'filled'

            return (
              <div key={row.id}>
                <div className="import-mapping-row">
                  <div className="import-mapping-row__left">
                    <span
                      className={`import-mapping-dot ${ok ? 'import-mapping-dot--ok' : 'import-mapping-dot--idle'}`}
                    />
                    <span className="import-mapping-field-label">
                      {row.label}
                      {showRequired || showRequiredName ? (
                        <span style={{ color: '#E74C3C' }}> *</span>
                      ) : null}
                    </span>
                  </div>
                  <span className="import-mapping-arrow" aria-hidden>
                    →
                  </span>
                  <div className="import-mapping-select-col">
                    <div
                      className={`import-mapping-select-wrap import-mapping-select--${selectVariant}`}
                    >
                      <Select
                        allowClear
                        placeholder="Non mappé — Sélectionnez..."
                        options={selectOptions}
                        value={value[row.id]}
                        onChange={(v) => setField(row.id, v ?? null)}
                        popupMatchSelectWidth={false}
                      />
                    </div>
                    {auto ? (
                      <Tag className="import-mapping-auto-badge">Auto</Tag>
                    ) : null}
                  </div>
                </div>

                {row.id === 'nomComplet' && fullCol ? (
                  <div className="import-mapping-fullname-box">
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#1C2833',
                        marginBottom: 8,
                      }}
                    >
                      Séparateur pour découper le nom complet
                    </div>
                    <div className="import-mapping-chip-row">
                      {SEP_OPTIONS.map((opt) => {
                        const on = fullNameSeparator === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`import-mapping-chip ${on ? 'import-mapping-chip--on' : ''}`}
                            onClick={() => {
                              onUseFullNameSplitChange(true)
                              onFullNameSeparatorChange(opt.value)
                            }}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                    <div className="import-mapping-preview-title">
                      Aperçu du découpage (3 premières lignes)
                    </div>
                    <div className="import-mapping-preview-box">
                      {sampleRows.slice(0, 3).map((r, i) => {
                        const raw = r[fullCol] ?? ''
                        const sp = splitFullNameValue(raw, fullNameSeparator)
                        return (
                          <div key={i} className="import-mapping-preview-line">
                            <strong>{raw || '—'}</strong>
                            {' → '}
                            {sp.prenom || '—'} / {sp.nom || '—'}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}

          <div className="import-mapping-footer-bar">
            <div className="import-mapping-count">
              <span className="import-mapping-count-dot" aria-hidden />
              <span>
                {requiredCount}/4 champs obligatoires mappés
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
