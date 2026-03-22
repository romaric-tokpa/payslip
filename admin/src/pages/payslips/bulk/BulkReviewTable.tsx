import { CloseOutlined, FilePdfOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Progress,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as payslipsApi from '../../../services/payslips.service'
import type {
  BulkAnalyzeRow,
  BulkUploadReport,
  ConfirmBulkAssignment,
} from '../../../types/payslips'
import { getApiErrorMessage } from '../../../utils/apiErrorMessage'
import { MONTHS_FR, yearOptions } from '../payslipUploadConstants'
import '../payslip-upload.css'
import { EmployeeSelect } from './EmployeeSelect'
import { MonthYearGlobalSelect } from './MonthYearGlobalSelect'

const { Text } = Typography

type FilterKey = 'all' | 'auto' | 'review' | 'unassigned' | 'file_error'

type RowState = {
  fileIndex: number
  filename: string
  extracted: BulkAnalyzeRow['extracted']
  match: BulkAnalyzeRow['match']
  apiStatus: BulkAnalyzeRow['status']
  serverDuplicate: boolean
  serverDupReason?: BulkAnalyzeRow['duplicateReason']
  duplicateMessage?: string
  blockingError?: string
  selectedUserId: string | null
  periodMonth: number | undefined
  periodYear: number | undefined
  initialUserId: string | null
  initialMonth: number | undefined
  initialYear: number | undefined
}

function buildRows(analyses: BulkAnalyzeRow[]): RowState[] {
  return analyses.map((a) => {
    const month = a.match.periodMonth ?? a.extracted.periodMonth
    const year = a.match.periodYear ?? a.extracted.periodYear
    return {
      fileIndex: a.fileIndex,
      filename: a.filename,
      extracted: a.extracted,
      match: a.match,
      apiStatus: a.status,
      serverDuplicate: a.duplicate,
      serverDupReason: a.duplicateReason,
      duplicateMessage: a.duplicateMessage,
      blockingError: a.blockingError,
      selectedUserId: a.match.userId ?? null,
      periodMonth: month,
      periodYear: year,
      initialUserId: a.match.userId ?? null,
      initialMonth: month,
      initialYear: year,
    }
  })
}

function payslipKey(
  userId: string,
  month: number,
  year: number,
): string {
  return `${userId}:${String(month)}:${String(year)}`
}

/** Vert &gt; 80 %, orange 40–80 %, rouge &lt; 40 %. */
function confidenceColor(conf: number): string {
  if (conf > 80) {
    return '#27AE60'
  }
  if (conf >= 40) {
    return '#F28C28'
  }
  return '#E74C3C'
}

type DbResolverProps = {
  fileIndex: number
  userId: string | null
  month: number | undefined
  year: number | undefined
  tripleMatchesInitial: boolean
  serverDbDuplicate: boolean
  onResult: (fileIndex: number, exists: boolean) => void
}

function DbDuplicateResolver({
  fileIndex,
  userId,
  month,
  year,
  tripleMatchesInitial,
  serverDbDuplicate,
  onResult,
}: DbResolverProps) {
  useEffect(() => {
    if (!userId || month == null || year == null) {
      onResult(fileIndex, false)
      return
    }
    if (tripleMatchesInitial && serverDbDuplicate) {
      onResult(fileIndex, true)
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      void payslipsApi
        .payslipExistsForUserPeriod(userId, month, year)
        .then((ex) => {
          if (!cancelled) {
            onResult(fileIndex, ex)
          }
        })
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [
    fileIndex,
    userId,
    month,
    year,
    tripleMatchesInitial,
    serverDbDuplicate,
    onResult,
  ])
  return null
}

type BulkReviewTableProps = {
  batchId: string
  analyses: BulkAnalyzeRow[]
  onAnalysesChange: (next: BulkAnalyzeRow[]) => void
  onRowRemoved?: () => void
  onBack: () => void
  onDistributed: (report: BulkUploadReport) => void
}

export function BulkReviewTable({
  batchId,
  analyses,
  onAnalysesChange,
  onRowRemoved,
  onBack,
  onDistributed,
}: BulkReviewTableProps) {
  const { message } = App.useApp()
  const [rows, setRows] = useState<RowState[]>(() => buildRows(analyses))
  const [filter, setFilter] = useState<FilterKey>('all')
  const [globalMonth, setGlobalMonth] = useState<number | null>(null)
  const [globalYear, setGlobalYear] = useState<number | null>(null)
  const [dbMap, setDbMap] = useState<Record<number, boolean>>(() => {
    const m: Record<number, boolean> = {}
    for (const a of analyses) {
      if (a.duplicate && a.duplicateReason === 'database') {
        m[a.fileIndex] = true
      }
    }
    return m
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const allowed = new Set(analyses.map((a) => a.fileIndex))
    setRows((prev) => prev.filter((r) => allowed.has(r.fileIndex)))
    setDbMap((prev) => {
      const next: Record<number, boolean> = {}
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k)
        if (allowed.has(idx)) {
          next[idx] = v
        }
      }
      for (const a of analyses) {
        if (a.duplicate && a.duplicateReason === 'database') {
          next[a.fileIndex] = true
        }
      }
      return next
    })
  }, [analyses])

  const onDbResult = useCallback((fileIndex: number, exists: boolean) => {
    setDbMap((prev) => {
      if (prev[fileIndex] === exists) {
        return prev
      }
      return { ...prev, [fileIndex]: exists }
    })
  }, [])

  const batchDupKeys = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      if (
        r.selectedUserId &&
        r.periodMonth != null &&
        r.periodYear != null
      ) {
        const k = payslipKey(r.selectedUserId, r.periodMonth, r.periodYear)
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
    }
    const dups = new Set<string>()
    for (const [k, c] of counts) {
      if (c > 1) {
        dups.add(k)
      }
    }
    return dups
  }, [rows])

  const rowMeta = useMemo(() => {
    const map = new Map<
      number,
      {
        isComplete: boolean
        batchDup: boolean
        dbDup: boolean
        dup: boolean
        ready: boolean
      }
    >()
    for (const r of rows) {
      const isComplete =
        Boolean(r.selectedUserId) &&
        r.periodMonth != null &&
        r.periodYear != null
      const k =
        r.selectedUserId && r.periodMonth != null && r.periodYear != null
          ? payslipKey(r.selectedUserId, r.periodMonth, r.periodYear)
          : ''
      const batchDup = k !== '' && batchDupKeys.has(k)
      const dbDup = dbMap[r.fileIndex] ?? false
      const dup = batchDup || dbDup
      const blocked = Boolean(r.blockingError)
      const ready = !blocked && isComplete && !dup
      map.set(r.fileIndex, {
        isComplete,
        batchDup,
        dbDup,
        dup,
        ready,
      })
    }
    return map
  }, [rows, batchDupKeys, dbMap])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const m = rowMeta.get(r.fileIndex)!
      if (filter === 'all') {
        return true
      }
      if (filter === 'file_error') {
        return Boolean(r.blockingError)
      }
      if (filter === 'auto') {
        return (
          r.apiStatus === 'auto_matched' && !m.dup && !r.blockingError
        )
      }
      if (filter === 'review') {
        return (
          (r.apiStatus === 'needs_review' || r.apiStatus === 'unmatched') &&
          !m.dup &&
          !r.blockingError
        )
      }
      if (filter === 'unassigned') {
        return (
          !r.blockingError && (!r.selectedUserId || !m.isComplete)
        )
      }
      return true
    })
  }, [rows, filter, rowMeta])

  const counts = useMemo(() => {
    let auto = 0
    let review = 0
    let unassigned = 0
    let dup = 0
    let fileErr = 0
    for (const r of rows) {
      if (r.blockingError) {
        fileErr += 1
        continue
      }
      const m = rowMeta.get(r.fileIndex)!
      if (m.dup) {
        dup += 1
        continue
      }
      if (!r.selectedUserId || !m.isComplete) {
        unassigned += 1
        continue
      }
      if (r.apiStatus === 'auto_matched') {
        auto += 1
      } else {
        review += 1
      }
    }
    return { auto, review, unassigned, dup, fileErr }
  }, [rows, rowMeta])

  function updateRow(
    fileIndex: number,
    patch: Partial<Pick<RowState, 'selectedUserId' | 'periodMonth' | 'periodYear'>>,
  ) {
    setRows((prev) =>
      prev.map((r) => (r.fileIndex === fileIndex ? { ...r, ...patch } : r)),
    )
  }

  function handleRemove(fileIndex: number) {
    onRowRemoved?.()
    onAnalysesChange(analyses.filter((a) => a.fileIndex !== fileIndex))
  }

  function applyGlobalMonthYear() {
    if (globalMonth == null || globalYear == null) {
      return
    }
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        periodMonth: globalMonth,
        periodYear: globalYear,
      })),
    )
  }

  async function handleDistribute() {
    const assignments: ConfirmBulkAssignment[] = []
    for (const r of rows) {
      const m = rowMeta.get(r.fileIndex)!
      if (!m.ready || !r.selectedUserId) {
        continue
      }
      assignments.push({
        fileIndex: r.fileIndex,
        userId: r.selectedUserId,
        periodMonth: r.periodMonth!,
        periodYear: r.periodYear!,
      })
    }
    if (assignments.length === 0) {
      message.warning('Aucun bulletin prêt à distribuer')
      return
    }
    setSubmitting(true)
    try {
      const rep = await payslipsApi.confirmBulkPayslips({
        batchId,
        assignments,
      })
      onDistributed(rep)
      if (rep.failed === 0) {
        message.success(`${rep.success} bulletin(s) distribué(s)`)
      } else {
        message.warning(
          `${rep.success} réussite(s), ${rep.failed} échec(s)`,
        )
      }
    } catch (e) {
      message.error(
        getApiErrorMessage(e, 'La distribution des bulletins a échoué'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const readyCount = rows.filter((r) => rowMeta.get(r.fileIndex)!.ready).length

  function rowClassName(r: RowState): string {
    if (r.blockingError) {
      return ''
    }
    const m = rowMeta.get(r.fileIndex)!
    if (m.dup) {
      return ''
    }
    if (!r.selectedUserId) {
      return 'bulk-review-row-unassigned'
    }
    if (!m.ready) {
      return 'bulk-review-row-review'
    }
    return ''
  }

  const columns: ColumnsType<RowState> = [
    {
      title: 'Fichier',
      dataIndex: 'filename',
      render: (_, r) => (
        <Space size={8}>
          <FilePdfOutlined style={{ color: '#E74C3C', fontSize: 16 }} />
          <Text ellipsis={{ tooltip: r.filename }} className="bulk-review-filename">
            {r.filename}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Collaborateur',
      key: 'collab',
      render: (_, r) => {
        if (r.blockingError) {
          return (
            <Text type="danger" style={{ display: 'block', maxWidth: 320 }}>
              {r.blockingError}
            </Text>
          )
        }

        const preset =
          r.match.userId && (r.match.employeeName || r.match.employeeId)
            ? {
                userId: r.match.userId,
                label: `${r.match.employeeId?.trim() || '—'} — ${r.match.employeeName ?? ''}`.trim(),
              }
            : null

        if (r.apiStatus === 'auto_matched' && r.match.userId) {
          return (
            <Space size={8} wrap>
              <span className="bulk-review-auto-line">
                {preset?.label ?? r.match.employeeName ?? r.match.userId}
              </span>
              <Tag className="bulk-review-auto-badge">Auto</Tag>
            </Space>
          )
        }

        if (r.apiStatus === 'needs_review') {
          return (
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              {preset ? (
                <Text type="warning" style={{ fontSize: 11 }}>
                  {preset.label}
                </Text>
              ) : null}
              <EmployeeSelect
                value={r.selectedUserId}
                preset={preset}
                onChange={(id) => updateRow(r.fileIndex, { selectedUserId: id })}
                status="warning"
                className="bulk-review-select-warning"
              />
            </Space>
          )
        }

        return (
          <EmployeeSelect
            value={r.selectedUserId}
            preset={null}
            onChange={(id) => updateRow(r.fileIndex, { selectedUserId: id })}
            status="error"
            className="bulk-review-select-error"
            placeholder="Non reconnu — sélectionnez…"
          />
        )
      },
    },
    {
      title: 'Mois',
      key: 'period',
      width: 200,
      render: (_, r) => (
        <Space size={8} wrap>
          <Select
            placeholder="Mois"
            allowClear
            style={{ minWidth: 120 }}
            value={r.periodMonth}
            options={MONTHS_FR.map((label, i) => ({
              value: i + 1,
              label,
            }))}
            onChange={(v) =>
              updateRow(r.fileIndex, {
                periodMonth: v == null ? undefined : Number(v),
              })
            }
            disabled={Boolean(r.blockingError)}
            popupMatchSelectWidth={false}
          />
          <Select
            placeholder="Année"
            allowClear
            style={{ minWidth: 88 }}
            value={r.periodYear}
            options={yearOptions().map((y) => ({
              value: y,
              label: String(y),
            }))}
            onChange={(v) =>
              updateRow(r.fileIndex, {
                periodYear: v == null ? undefined : Number(v),
              })
            }
            disabled={Boolean(r.blockingError)}
          />
        </Space>
      ),
    },
    {
      title: 'Confiance',
      key: 'conf',
      width: 72,
      align: 'center',
      render: (_, r) => {
        if (r.blockingError) {
          return <Text type="secondary">—</Text>
        }
        const c = r.match.confidence
        return (
          <div className="bulk-review-conf-bar">
            <Progress
              percent={c}
              size="small"
              showInfo={false}
              strokeColor={confidenceColor(c)}
              strokeWidth={6}
            />
          </div>
        )
      },
    },
    {
      title: 'Statut',
      key: 'status',
      width: 130,
      render: (_, r) => {
        const m = rowMeta.get(r.fileIndex)!
        if (r.blockingError) {
          return <Tag className="bulk-review-status-err">Erreur</Tag>
        }
        if (m.dup) {
          const fallback =
            m.batchDup && m.dbDup
              ? 'Doublon dans le lot et en base'
              : m.batchDup
                ? 'Même collaborateur et période plusieurs fois dans le lot'
                : 'Un bulletin existe déjà pour cette période'
          const tip = r.duplicateMessage ?? fallback
          return (
            <Tag className="bulk-review-status-dup" title={tip}>
              Doublon
            </Tag>
          )
        }
        if (!r.selectedUserId) {
          return <Tag className="bulk-review-status-err">Non assigné</Tag>
        }
        if (r.periodMonth == null || r.periodYear == null) {
          return <Tag className="bulk-review-status-review">À vérifier</Tag>
        }
        if (m.ready) {
          return <Tag className="bulk-review-status-ready">Prêt</Tag>
        }
        return <Tag className="bulk-review-status-review">À vérifier</Tag>
      },
    },
    {
      title: '',
      key: 'action',
      width: 44,
      render: (_, r) => (
        <Button
          type="text"
          danger
          icon={<CloseOutlined />}
          aria-label="Retirer le fichier"
          onClick={() => handleRemove(r.fileIndex)}
        />
      ),
    },
  ]

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      {rows
        .filter((r) => !r.blockingError)
        .map((r) => {
          const tripleMatchesInitial =
            r.selectedUserId === r.initialUserId &&
            r.periodMonth === r.initialMonth &&
            r.periodYear === r.initialYear
          const serverDbDuplicate =
            r.serverDuplicate && r.serverDupReason === 'database'
          return (
            <DbDuplicateResolver
              key={r.fileIndex}
              fileIndex={r.fileIndex}
              userId={r.selectedUserId}
              month={r.periodMonth}
              year={r.periodYear}
              tripleMatchesInitial={tripleMatchesInitial}
              serverDbDuplicate={serverDbDuplicate}
              onResult={onDbResult}
            />
          )
        })}

      <div className="bulk-review-toolbar">
        <div className="bulk-review-chips">
          <Tag className="bulk-review-chip bulk-review-chip--auto">
            <strong>{counts.auto}</strong> auto-détectés
          </Tag>
          <Tag className="bulk-review-chip bulk-review-chip--review">
            <strong>{counts.review}</strong> à vérifier
          </Tag>
          <Tag className="bulk-review-chip bulk-review-chip--unassigned">
            <strong>{counts.unassigned}</strong> non assignés
          </Tag>
          {counts.dup > 0 ? (
            <Tag className="bulk-review-chip bulk-review-chip--dup">
              <strong>{counts.dup}</strong> doublons
            </Tag>
          ) : null}
          {counts.fileErr > 0 ? (
            <Tag className="bulk-review-chip bulk-review-chip--file">
              <strong>{counts.fileErr}</strong> fichiers bloqués
            </Tag>
          ) : null}
        </div>
        <MonthYearGlobalSelect
          month={globalMonth}
          year={globalYear}
          onMonthChange={setGlobalMonth}
          onYearChange={setGlobalYear}
          onApplyToAll={applyGlobalMonthYear}
          disabled={submitting}
        />
      </div>

      <Segmented<FilterKey>
        options={[
          { label: 'Tous', value: 'all' },
          { label: 'Auto-détectés', value: 'auto' },
          { label: 'À vérifier', value: 'review' },
          { label: 'Non assignés', value: 'unassigned' },
          { label: 'Fichiers bloqués', value: 'file_error' },
        ]}
        value={filter}
        onChange={(v) => setFilter(v)}
      />

      <Card className="bulk-review-table-card" variant="outlined">
        <Table<RowState>
          className="bulk-review-table"
          rowKey={(r) => String(r.fileIndex)}
          columns={columns}
          dataSource={filteredRows}
          pagination={{ pageSize: 25, showSizeChanger: true, size: 'small' }}
          scroll={{ x: 980 }}
          rowClassName={(r) => rowClassName(r)}
        />
      </Card>

      <div className="bulk-review-footer">
        <Button onClick={onBack} disabled={submitting} variant="outlined">
          Retour
        </Button>
        <div className="bulk-review-footer__right">
          <Button
            type="primary"
            loading={submitting}
            onClick={() => void handleDistribute()}
            className="payslip-btn-teal"
          >
            {readyCount <= 1
              ? `Distribuer ${readyCount === 0 ? '…' : 'le bulletin'}`
              : `Distribuer les ${String(readyCount)} bulletins`}
          </Button>
        </div>
      </div>
    </Space>
  )
}
