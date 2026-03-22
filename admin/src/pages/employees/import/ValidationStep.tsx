import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Checkbox,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Key } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ADMIN_BASE } from '../../../constants/adminRoutes'
import { adminTheme } from '../../../theme/adminTheme'
import type {
  ImportRowDto,
  ValidateImportResponse,
  ValidatedRow,
} from '../../../types/employees'
import { EditableCell } from './EditableCell'
import { UpdateComparisonRow } from './UpdateComparisonRow'
import './import-flow.css'

const { Text } = Typography

export type ValidationStepProps = {
  validationResult: ValidateImportResponse
  onConfirm: (selectedRows: ImportRowDto[]) => void | Promise<void>
  onBack: () => void
  onRevalidate: (updatedRows: ImportRowDto[]) => Promise<ValidateImportResponse>
  commitLoading?: boolean
}

type FilterKey = 'all' | 'ready' | 'update' | 'error' | 'warning'

function statusTag(status: ValidatedRow['status']) {
  if (status === 'ready') {
    return (
      <Tag color="success" style={{ margin: 0, fontSize: 10 }}>
        Prêt
      </Tag>
    )
  }
  if (status === 'update') {
    return (
      <Tag color="processing" style={{ margin: 0, fontSize: 10 }}>
        MAJ
      </Tag>
    )
  }
  if (status === 'error') {
    return (
      <Tag color="error" style={{ margin: 0, fontSize: 10 }}>
        Erreur
      </Tag>
    )
  }
  return (
    <Tag color="warning" style={{ margin: 0, fontSize: 10 }}>
      Alerte
    </Tag>
  )
}

function rowBg(status: ValidatedRow['status']): string {
  if (status === 'update') {
    return '#F5FAFF'
  }
  if (status === 'error') {
    return '#FDF5F5'
  }
  if (status === 'warning') {
    return '#FFFBF5'
  }
  return '#FFFFFF'
}

export function ValidationStep({
  validationResult,
  onConfirm,
  onBack,
  onRevalidate,
  commitLoading = false,
}: ValidationStepProps) {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const { summary, rows: validatedRows } = validationResult

  const [rowsData, setRowsData] = useState<ImportRowDto[]>(() =>
    validatedRows.map((r) => ({ ...r.data })),
  )
  const [include, setInclude] = useState<Set<number>>(() => {
    const s = new Set<number>()
    for (const r of validatedRows) {
      if (r.status !== 'error') {
        s.add(r.rowIndex)
      }
    }
    return s
  })
  const [filter, setFilter] = useState<FilterKey>(() =>
    summary.errors > 0 ? 'error' : 'all',
  )
  const [dirty, setDirty] = useState(false)
  const [revalidating, setRevalidating] = useState(false)
  const [expanded, setExpanded] = useState<readonly Key[]>([])

  useEffect(() => {
    const vr = validationResult.rows
    setRowsData(vr.map((r) => ({ ...r.data })))
    const s = new Set<number>()
    for (const r of vr) {
      if (r.status !== 'error') {
        s.add(r.rowIndex)
      }
    }
    setInclude(s)
    setDirty(false)
    setExpanded([])
    if (validationResult.summary.errors > 0) {
      setFilter('error')
    } else {
      setFilter('all')
    }
  }, [validationResult])

  const rowByIndex = useMemo(() => {
    const m = new Map<number, ValidatedRow>()
    for (const r of validatedRows) {
      m.set(r.rowIndex, r)
    }
    return m
  }, [validatedRows])

  const dataIndexByRowIndex = useMemo(() => {
    const m = new Map<number, number>()
    validatedRows.forEach((r, i) => m.set(r.rowIndex, i))
    return m
  }, [validatedRows])

  const updateRowField = useCallback(
    (rowIndex: number, field: string, value: string) => {
      const i = dataIndexByRowIndex.get(rowIndex)
      if (i === undefined) {
        return
      }
      setRowsData((prev) => {
        const next = [...prev]
        const cur = { ...next[i] } as Record<string, unknown>
        cur[field] = value
        next[i] = cur as ImportRowDto
        return next
      })
      setDirty(true)
    },
    [dataIndexByRowIndex],
  )

  const filteredRows = useMemo(() => {
    return validatedRows.filter((r) => {
      if (filter === 'all') {
        return true
      }
      return r.status === filter
    })
  }, [validatedRows, filter])

  const visibleSelectedCount = useMemo(() => {
    let n = 0
    for (const r of filteredRows) {
      if (include.has(r.rowIndex)) {
        n += 1
      }
    }
    return n
  }, [filteredRows, include])

  const selectedCount = useMemo(() => include.size, [include])

  const handleRevalidate = async () => {
    setRevalidating(true)
    try {
      const ordered = validatedRows.map((vr, i) => ({
        ...rowsData[i],
        rowIndex: vr.rowIndex,
      }))
      await onRevalidate(ordered)
      message.success('Validation mise à jour')
    } catch (e) {
      message.error(
        e instanceof Error ? e.message : 'Échec de la revalidation',
      )
    } finally {
      setRevalidating(false)
    }
  }

  const openImportConfirm = () => {
    const ordered: ImportRowDto[] = []
    for (let i = 0; i < validatedRows.length; i += 1) {
      const vr = validatedRows[i]
      if (!include.has(vr.rowIndex)) {
        continue
      }
      ordered.push({ ...rowsData[i], rowIndex: vr.rowIndex })
    }

    if (ordered.length === 0) {
      message.warning('Sélectionnez au moins une ligne')
      return
    }

    let readyN = 0
    let updN = 0
    let errChecked = 0
    for (const row of ordered) {
      const vr = rowByIndex.get(row.rowIndex)
      if (!vr) {
        continue
      }
      if (
        vr.status === 'ready' ||
        vr.status === 'warning'
      ) {
        readyN += 1
      } else if (vr.status === 'update') {
        updN += 1
      }
      if (vr.status === 'error') {
        errChecked += 1
      }
    }

    const excluded = summary.total - ordered.length

    modal.confirm({
      title: "Confirmer l'import",
      width: 480,
      content: (
        <div>
          <ul style={{ paddingLeft: 18, marginBottom: 12 }}>
            <li>
              <Text>
                {readyN} nouveau(x) collaborateur(s) seront créés
              </Text>
            </li>
            <li>
              <Text>{updN} collaborateur(s) existant(s) seront mis à jour</Text>
            </li>
            <li>
              <Text>{excluded} ligne(s) seront ignorées</Text>
            </li>
          </ul>
          {errChecked > 0 ? (
            <Text type="danger">
              Attention : {errChecked} ligne(s) affichent encore des erreurs et
              pourront échouer côté serveur.
            </Text>
          ) : null}
        </div>
      ),
      okText: "Confirmer l'import",
      cancelText: 'Annuler',
      onOk: () => Promise.resolve(onConfirm(ordered)),
    })
  }

  const columns: ColumnsType<ValidatedRow> = [
    {
      title: 'LN',
      key: 'ln',
      width: 40,
      render: (_, r) => (
        <Text type="secondary" style={{ fontSize: 9 }}>
          {r.rowIndex + 2}
        </Text>
      ),
    },
    {
      title: 'Statut',
      key: 'st',
      width: 76,
      render: (_, r) => statusTag(r.status),
    },
    {
      title: 'Matricule',
      key: 'mat',
      width: 120,
      render: (_, r) => {
        const i = dataIndexByRowIndex.get(r.rowIndex) ?? 0
        const d = rowsData[i] ?? r.data
        const hasErr = r.errors.some((e) => e.field === 'employeeId')
        return (
          <EditableCell
            field="employeeId"
            value={d.employeeId ?? ''}
            originalValue={r.data.employeeId ?? ''}
            errors={r.errors}
            editable={hasErr}
            onChange={(f, v) => updateRowField(r.rowIndex, f, v)}
          />
        )
      },
    },
    {
      title: 'Prénom',
      key: 'fn',
      width: 120,
      render: (_, r) => {
        const i = dataIndexByRowIndex.get(r.rowIndex) ?? 0
        const d = rowsData[i] ?? r.data
        const hasErr = r.errors.some((e) => e.field === 'firstName')
        return (
          <EditableCell
            field="firstName"
            value={d.firstName}
            originalValue={r.data.firstName}
            errors={r.errors}
            editable={hasErr}
            onChange={(f, v) => updateRowField(r.rowIndex, f, v)}
          />
        )
      },
    },
    {
      title: 'Nom',
      key: 'ln2',
      width: 120,
      render: (_, r) => {
        const i = dataIndexByRowIndex.get(r.rowIndex) ?? 0
        const d = rowsData[i] ?? r.data
        const hasErr = r.errors.some((e) => e.field === 'lastName')
        return (
          <EditableCell
            field="lastName"
            value={d.lastName}
            originalValue={r.data.lastName}
            errors={r.errors}
            editable={hasErr}
            onChange={(f, v) => updateRowField(r.rowIndex, f, v)}
          />
        )
      },
    },
    {
      title: 'E-mail',
      key: 'em',
      width: 220,
      render: (_, r) => {
        const i = dataIndexByRowIndex.get(r.rowIndex) ?? 0
        const d = rowsData[i] ?? r.data
        const hasErr = r.errors.some((e) => e.field === 'email')
        const dupFile = r.errors.find((e) => e.code === 'DUPLICATE_IN_FILE')
        const dupEmail = r.errors.find((e) => e.code === 'DUPLICATE_EMAIL')
        if (hasErr) {
          return (
            <div>
              <EditableCell
                field="email"
                value={d.email}
                originalValue={r.data.email}
                errors={r.errors}
                editable
                onChange={(f, v) => updateRowField(r.rowIndex, f, v)}
              />
              {dupFile ? (
                <Text type="danger" style={{ fontSize: 10, display: 'block' }}>
                  {dupFile.message}
                </Text>
              ) : null}
              {dupEmail ? (
                <Button
                  type="link"
                  size="small"
                  style={{ paddingLeft: 0, fontSize: 10, height: 'auto' }}
                  onClick={() => navigate(`${ADMIN_BASE}/employees`)}
                >
                  Voir le collaborateur existant
                </Button>
              ) : null}
            </div>
          )
        }
        return <Text style={{ fontSize: 10 }}>{d.email}</Text>
      },
    },
    {
      title: 'Dépt.',
      key: 'dep',
      width: 100,
      render: (_, r) => {
        const i = dataIndexByRowIndex.get(r.rowIndex) ?? 0
        const d = rowsData[i] ?? r.data
        const t = d.departmentName?.trim()
        return (
          <Text type="secondary" style={{ fontSize: 9, fontStyle: t ? 'normal' : 'italic' }}>
            {t || 'Aucun'}
          </Text>
        )
      },
    },
    {
      title: 'Svc.',
      key: 'svc',
      width: 100,
      render: (_, r) => {
        const i = dataIndexByRowIndex.get(r.rowIndex) ?? 0
        const d = rowsData[i] ?? r.data
        const t = d.serviceName?.trim()
        return (
          <Text type="secondary" style={{ fontSize: 9 }}>
            {t || '—'}
          </Text>
        )
      },
    },
    {
      title: 'Alertes',
      key: 'al',
      width: 200,
      render: (_, r) => (
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          {r.errors.map((e) => (
            <Tag key={`${e.code}-${e.field}`} color="red" style={{ margin: 0, fontSize: 10 }}>
              {e.message}
            </Tag>
          ))}
          {r.warnings.map((w) => (
            <Tag key={`${w.code}-${w.field}`} color="orange" style={{ margin: 0, fontSize: 10 }}>
              {w.message}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Inclure',
      key: 'inc',
      width: 72,
      fixed: 'right',
      render: (_, r) => (
        <Checkbox
          checked={include.has(r.rowIndex)}
          onChange={(e) => {
            const on = e.target.checked
            setInclude((prev) => {
              const n = new Set(prev)
              if (on) {
                n.add(r.rowIndex)
              } else {
                n.delete(r.rowIndex)
              }
              return n
            })
          }}
        />
      ),
    },
  ]

  return (
    <div className="import-validation-step">
      <div className="import-validation-summary">
        <div
          className="import-validation-card"
          style={{ background: adminTheme.greenBg }}
        >
          <CheckCircleOutlined style={{ color: adminTheme.green, fontSize: 18 }} />
          <div>
            <div className="import-validation-card__num" style={{ color: adminTheme.green }}>
              {summary.ready}
            </div>
            <div className="import-validation-card__lbl">Prêts</div>
          </div>
        </div>
        <div
          className="import-validation-card"
          style={{ background: adminTheme.blueBg }}
        >
          <SyncOutlined style={{ color: adminTheme.blue, fontSize: 18 }} />
          <div>
            <div className="import-validation-card__num" style={{ color: adminTheme.blue }}>
              {summary.updates}
            </div>
            <div className="import-validation-card__lbl">Mises à jour</div>
          </div>
        </div>
        <div
          className="import-validation-card"
          style={{ background: adminTheme.redBg }}
        >
          <CloseCircleOutlined style={{ color: adminTheme.red, fontSize: 18 }} />
          <div>
            <div className="import-validation-card__num" style={{ color: adminTheme.red }}>
              {summary.errors}
            </div>
            <div className="import-validation-card__lbl">Erreurs</div>
          </div>
        </div>
        <div
          className="import-validation-card"
          style={{ background: adminTheme.orangeBg }}
        >
          <WarningOutlined style={{ color: adminTheme.orange, fontSize: 18 }} />
          <div>
            <div
              className="import-validation-card__num"
              style={{ color: adminTheme.orange }}
            >
              {summary.warnings}
            </div>
            <div className="import-validation-card__lbl">Avertissements</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Segmented<FilterKey>
          value={filter}
          onChange={(v) => setFilter(v)}
          options={[
            { label: `Tout (${summary.total})`, value: 'all' },
            { label: `Prêts (${summary.ready})`, value: 'ready' },
            { label: `MAJ (${summary.updates})`, value: 'update' },
            { label: `Erreurs (${summary.errors})`, value: 'error' },
            { label: `Alertes (${summary.warnings})`, value: 'warning' },
          ]}
        />
      </div>

      <Space style={{ marginBottom: 8 }}>
        <Button
          icon={<ReloadOutlined />}
          loading={revalidating}
          disabled={!dirty}
          onClick={() => void handleRevalidate()}
          className="import-btn-outline-teal"
        >
          Revalider les modifications
        </Button>
      </Space>

      <Table<ValidatedRow>
        size="small"
        rowKey={(r) => String(r.rowIndex)}
        dataSource={filteredRows}
        columns={columns}
        scroll={{ x: 1100, y: 420 }}
        pagination={{
          pageSize: 100,
          showSizeChanger: true,
          pageSizeOptions: [50, 100, 200, 500],
          showTotal: (t) => `${t} ligne(s)`,
        }}
        expandable={{
          expandedRowRender: (r) =>
            r.status === 'update' && r.existingSnapshot ? (
              <UpdateComparisonRow
                existingData={r.existingSnapshot}
                newData={rowsData[dataIndexByRowIndex.get(r.rowIndex) ?? 0] ?? r.data}
              />
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Aucune comparaison pour cette ligne.
              </Text>
            ),
          expandedRowKeys: expanded,
          onExpandedRowsChange: (keys) => setExpanded(keys),
          rowExpandable: (r) => r.status === 'update' && Boolean(r.existingSnapshot),
        }}
        onRow={(r) => ({
          style: { background: rowBg(r.status) },
        })}
      />

      <div className="import-validation-sticky">
        <div className="import-validation-sticky__inner">
          <Text type="secondary" style={{ fontSize: 11 }}>
            {selectedCount} ligne(s) sélectionnée(s) sur {summary.total}
          </Text>
          <Space size="middle" wrap className="import-validation-sticky__center">
            <Checkbox
              indeterminate={
                visibleSelectedCount > 0 && visibleSelectedCount < filteredRows.length
              }
              checked={
                filteredRows.length > 0 && visibleSelectedCount === filteredRows.length
              }
              onChange={(e) => {
                const on = e.target.checked
                setInclude((prev) => {
                  const n = new Set(prev)
                  for (const r of filteredRows) {
                    if (on) {
                      n.add(r.rowIndex)
                    } else {
                      n.delete(r.rowIndex)
                    }
                  }
                  return n
                })
              }}
            >
              Sélectionner tout (vue)
            </Checkbox>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setInclude((prev) => {
                  const n = new Set(prev)
                  for (const r of validatedRows) {
                    if (r.status === 'error') {
                      n.delete(r.rowIndex)
                    }
                  }
                  return n
                })
              }}
            >
              Exclure les erreurs
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setInclude((prev) => {
                  const n = new Set(prev)
                  for (const r of validatedRows) {
                    if (r.errors.length === 0) {
                      n.add(r.rowIndex)
                    }
                  }
                  return n
                })
              }}
            >
              Inclure les lignes sans erreur
            </Button>
          </Space>
          <Space wrap>
            <Button onClick={onBack}>Retour</Button>
            {dirty ? (
              <Button
                icon={<ReloadOutlined />}
                loading={revalidating}
                disabled={!dirty}
                onClick={() => void handleRevalidate()}
                className="import-btn-outline-teal"
              >
                Revalider
              </Button>
            ) : null}
            <Button
              type="primary"
              disabled={selectedCount === 0}
              loading={commitLoading}
              onClick={() => openImportConfirm()}
              className="import-btn-teal"
            >
              Importer {selectedCount} collaborateur(s)
            </Button>
          </Space>
        </div>
      </div>
    </div>
  )
}
